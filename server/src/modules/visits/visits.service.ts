import { db } from "../../config/db.js";
import { emitToRooms, getIo, roomsForSheds } from "../../config/socket.js";
import type { RequestUser } from "../../types/domain.js";
import { writeAudit } from "../../utils/audit.js";
import { ApiError } from "../../utils/errors.js";
import { withDeadlockRetry } from "../../utils/retry.js";
import {
    lockItemForUpdate,
    lockLineForUpdate,
    lockLineStatusesForUpdate,
    lockVisitForUpdate,
    lockVisitLinesForUpdate,
} from "../../utils/rowLocks.js";
import { recalcVisitStatus } from "../../utils/visitStatus.js";
import type { CreateVisitInput } from "../../validators/visit.schemas.js";
import {
    lineInclude,
    toLineDto,
    toVisitDto,
    visitInclude,
} from "./visits.dto.js";

export async function createVisit(input: CreateVisitInput, gateUserId: number) {
    const itemIds = input.lines.map((line) => line.itemId);
    if (new Set(itemIds).size !== itemIds.length) {
        throw new ApiError("DUPLICATE_LINE", "Duplicate item in lines", 400);
    }
    const items = await db.item.findMany({
        where: { id: { in: itemIds } },
        include: { shed: true },
    });
    if (items.length !== itemIds.length) {
        const found = new Set(items.map((item) => item.id));
        const missing = itemIds.find((id) => !found.has(id));
        throw new ApiError("ITEM_NOT_FOUND", `Item ${missing} not found`, 404);
    }
    const inactive = items.find((item) => !item.isActive);
    if (inactive) {
        throw new ApiError(
            "ITEM_INACTIVE",
            `Item ${inactive.id} is archived`,
            409,
        );
    }
    const byId = new Map(items.map((item) => [item.id, item]));
    const warnings = input.lines
        .filter((line) => {
            const item = byId.get(line.itemId);
            return item !== undefined && line.qty > item.currentStock;
        })
        .map((line) => ({
            itemId: line.itemId,
            requested: line.qty,
            available: byId.get(line.itemId)?.currentStock ?? 0,
        }));

    const created = await db.$transaction(async (tx) => {
        const visit = await tx.visit.create({
            data: {
                vehicleNumber: input.vehicleNumber,
                driverName: input.driverName,
                party: input.party,
                status: "AWAITING_LOADING",
                gateUserId,
                requirementLines: {
                    create: input.lines.map((line) => ({
                        itemId: line.itemId,
                        shedId: byId.get(line.itemId)?.shedId ?? 0,
                        requestedQty: line.qty,
                        status: "PENDING",
                    })),
                },
            },
            include: visitInclude,
        });
        await writeAudit(tx, {
            userId: gateUserId,
            action: "VISIT_CREATED",
            entity: "Visit",
            entityId: visit.id,
        });
        return visit;
    });

    const dto = toVisitDto(created);
    const at = new Date().toISOString();
    const rooms = roomsForSheds(dto.lines.map((line) => line.shed.code));
    emitToRooms(getIo(), rooms, "requirement.created", {
        visitId: dto.id,
        at,
    });
    emitToRooms(getIo(), rooms, "visit.statusChanged", {
        visitId: dto.id,
        status: dto.status,
        at,
    });
    return { visit: dto, warnings };
}

export async function listInside() {
    const visits = await db.visit.findMany({
        where: { status: { notIn: ["CHECKED_OUT", "CANCELLED"] } },
        include: visitInclude,
        orderBy: { arrivalAt: "desc" },
    });
    return visits.map(toVisitDto);
}

export async function cancelVisit(visitId: number, userId: number) {
    const visit = await db.$transaction(async (tx) => {
        const lockedVisit = await lockVisitForUpdate(tx, visitId);
        if (!lockedVisit) {
            throw new ApiError("VISIT_NOT_FOUND", "Visit not found", 404);
        }
        if (lockedVisit.status === "CHECKED_OUT") {
            throw new ApiError(
                "ALREADY_CHECKED_OUT",
                "Visit already checked out",
                409,
            );
        }
        if (lockedVisit.status === "CANCELLED") {
            throw new ApiError(
                "ALREADY_CANCELLED",
                "Visit already cancelled",
                409,
            );
        }
        const lines = await lockVisitLinesForUpdate(tx, visitId);
        if (lines.some((line) => line.status === "LOADED")) {
            throw new ApiError(
                "HAS_LOADED_LINES",
                "Cannot cancel: some lines already loaded",
                409,
            );
        }
        await tx.requirementLine.updateMany({
            where: { visitId, status: "PENDING" },
            data: { status: "CANCELLED" },
        });
        const updated = await tx.visit.update({
            where: { id: visitId },
            data: { status: "CANCELLED", cancelledAt: new Date() },
            include: visitInclude,
        });
        await writeAudit(tx, {
            userId,
            action: "VISIT_CANCELLED",
            entity: "Visit",
            entityId: visitId,
        });
        return updated;
    });
    const dto = toVisitDto(visit);
    emitToRooms(
        getIo(),
        roomsForSheds(dto.lines.map((line) => line.shed.code)),
        "visit.statusChanged",
        {
            visitId: dto.id,
            status: dto.status,
            at: new Date().toISOString(),
        },
    );
    return dto;
}

export async function cancelLine(lineId: number, userId: number) {
    const result = await db.$transaction(async (tx) => {
        const lineRef = await tx.requirementLine.findUnique({
            where: { id: lineId },
            select: { visitId: true },
        });
        if (!lineRef) {
            throw new ApiError("LINE_NOT_FOUND", "Line not found", 404);
        }
        const visit = await lockVisitForUpdate(tx, lineRef.visitId);
        if (!visit) {
            throw new ApiError("VISIT_NOT_FOUND", "Visit not found", 404);
        }
        if (visit.status === "CHECKED_OUT" || visit.status === "CANCELLED") {
            throw new ApiError("VISIT_CLOSED", "Visit is already closed", 409);
        }
        const locked = await lockLineForUpdate(tx, lineId);
        if (!locked) {
            throw new ApiError("LINE_NOT_FOUND", "Line not found", 404);
        }
        if (locked.status !== "PENDING") {
            throw new ApiError(
                "ALREADY_RESOLVED",
                "Only pending lines can be cancelled",
                409,
            );
        }
        await tx.requirementLine.update({
            where: { id: lineId },
            data: { status: "CANCELLED" },
        });
        const statuses = await lockLineStatusesForUpdate(tx, locked.visitId);
        const next = recalcVisitStatus(statuses);
        await tx.visit.update({
            where: { id: locked.visitId },
            data: {
                status: next,
                cancelledAt: next === "CANCELLED" ? new Date() : null,
            },
        });
        await writeAudit(tx, {
            userId,
            action: "LINE_CANCELLED",
            entity: "RequirementLine",
            entityId: lineId,
        });
        const full = await tx.requirementLine.findUniqueOrThrow({
            where: { id: lineId },
            include: lineInclude,
        });
        return { line: toLineDto(full), visitStatus: next };
    });
    const at = new Date().toISOString();
    emitToRooms(
        getIo(),
        roomsForSheds([result.line.shed.code]),
        "visit.statusChanged",
        {
            visitId: result.line.visitId,
            status: result.visitStatus,
            at,
        },
    );
    return result.line;
}

export async function confirmLine(
    lineId: number,
    loadedQty: number,
    user: RequestUser,
) {
    if (user.role !== "SHED" && user.role !== "ADMIN") {
        throw new ApiError(
            "FORBIDDEN",
            "Only shed users can confirm loading",
            403,
        );
    }
    const result = await withDeadlockRetry(() =>
        db.$transaction(async (tx) => {
            const lineRef = await tx.requirementLine.findUnique({
                where: { id: lineId },
                select: { visitId: true },
            });
            if (!lineRef) {
                throw new ApiError("LINE_NOT_FOUND", "Line not found", 404);
            }
            const visit = await lockVisitForUpdate(tx, lineRef.visitId);
            if (!visit) {
                throw new ApiError("VISIT_NOT_FOUND", "Visit not found", 404);
            }
            const locked = await lockLineForUpdate(tx, lineId);
            if (!locked) {
                throw new ApiError("LINE_NOT_FOUND", "Line not found", 404);
            }
            if (
                user.role === "SHED" &&
                (user.shedId === null || locked.shedId !== user.shedId)
            ) {
                throw new ApiError(
                    "CROSS_SHED",
                    "Cannot confirm lines of another shed",
                    403,
                );
            }
            if (visit.status === "CHECKED_OUT") {
                throw new ApiError(
                    "VISIT_CHECKED_OUT",
                    "Visit already checked out",
                    409,
                );
            }
            if (visit.status === "CANCELLED") {
                throw new ApiError(
                    "VISIT_CANCELLED",
                    "Visit is cancelled",
                    409,
                );
            }
            if (locked.status !== "PENDING") {
                throw new ApiError(
                    "ALREADY_CONFIRMED",
                    "Line already confirmed",
                    409,
                );
            }
            if (loadedQty < 1 || loadedQty > locked.requestedQty) {
                throw new ApiError(
                    "INVALID_QTY",
                    `loadedQty must be between 1 and ${locked.requestedQty}`,
                    400,
                );
            }
            const item = await lockItemForUpdate(tx, locked.itemId);
            if (!item) {
                throw new ApiError("ITEM_NOT_FOUND", "Item not found", 404);
            }
            const balanceAfter = item.currentStock - loadedQty;
            await tx.item.update({
                where: { id: item.id },
                data: { currentStock: balanceAfter },
            });
            await tx.requirementLine.update({
                where: { id: lineId },
                data: {
                    status: "LOADED",
                    loadedQty,
                    confirmedByUserId: user.id,
                    confirmedAt: new Date(),
                },
            });
            await tx.stockLedger.create({
                data: {
                    itemId: item.id,
                    requirementLineId: lineId,
                    visitId: locked.visitId,
                    actorUserId: user.id,
                    type: "OUT",
                    delta: -loadedQty,
                    balanceAfter,
                },
            });
            const statuses = await lockLineStatusesForUpdate(
                tx,
                locked.visitId,
            );
            const next = recalcVisitStatus(statuses);
            await tx.visit.update({
                where: { id: locked.visitId },
                data: { status: next },
            });
            await writeAudit(tx, {
                userId: user.id,
                action: "LINE_CONFIRMED",
                entity: "RequirementLine",
                entityId: lineId,
            });
            const full = await tx.requirementLine.findUniqueOrThrow({
                where: { id: lineId },
                include: lineInclude,
            });
            const visitSheds = await tx.requirementLine.findMany({
                where: { visitId: locked.visitId },
                select: { shed: { select: { code: true } } },
            });
            return {
                line: toLineDto(full),
                visitStatus: next,
                visitShedCodes: visitSheds.map((row) => row.shed.code),
            };
        }),
    );
    const { line } = result;
    const at = new Date().toISOString();
    const rooms = roomsForSheds([line.shed.code, ...result.visitShedCodes]);
    emitToRooms(getIo(), rooms, "loading.confirmed", {
        lineId: line.id,
        visitId: line.visitId,
        itemId: line.itemId,
        at,
    });
    emitToRooms(getIo(), rooms, "visit.statusChanged", {
        visitId: line.visitId,
        status: result.visitStatus,
        at,
    });
    emitToRooms(getIo(), rooms, "stock.updated", {
        itemId: line.itemId,
        at,
    });
    emitToRooms(getIo(), rooms, "inventory.changed", {
        itemId: line.itemId,
        at,
    });
    return line;
}

export async function checkoutVisit(visitId: number, userId: number) {
    const visit = await withDeadlockRetry(() =>
        db.$transaction(async (tx) => {
            const lockedVisit = await lockVisitForUpdate(tx, visitId);
            if (!lockedVisit) {
                throw new ApiError("VISIT_NOT_FOUND", "Visit not found", 404);
            }
            if (lockedVisit.status === "CHECKED_OUT") {
                throw new ApiError(
                    "ALREADY_CHECKED_OUT",
                    "Visit already checked out",
                    409,
                );
            }
            if (lockedVisit.status === "CANCELLED") {
                throw new ApiError(
                    "VISIT_CANCELLED",
                    "Visit is cancelled",
                    409,
                );
            }
            const lines = await lockVisitLinesForUpdate(tx, visitId);
            if (lines.some((line) => line.status === "PENDING")) {
                throw new ApiError(
                    "NOT_READY",
                    "All lines must be loaded before checkout",
                    409,
                );
            }
            if (!lines.some((line) => line.status === "LOADED")) {
                throw new ApiError(
                    "NOTHING_LOADED",
                    "No loaded lines to checkout",
                    409,
                );
            }
            const updated = await tx.visit.updateMany({
                where: { id: visitId, status: "READY_FOR_CHECKOUT" },
                data: {
                    status: "CHECKED_OUT",
                    checkoutAt: new Date(),
                    checkoutByUserId: userId,
                },
            });
            if (updated.count === 0) {
                throw new ApiError(
                    "NOT_READY",
                    "Visit is not ready for checkout",
                    409,
                );
            }
            await writeAudit(tx, {
                userId,
                action: "VISIT_CHECKOUT",
                entity: "Visit",
                entityId: visitId,
            });
            const full = await tx.visit.findUniqueOrThrow({
                where: { id: visitId },
                include: visitInclude,
            });
            return toVisitDto(full);
        }),
    );
    emitToRooms(
        getIo(),
        roomsForSheds(visit.lines.map((line) => line.shed.code)),
        "visit.statusChanged",
        {
            visitId: visit.id,
            status: visit.status,
            at: new Date().toISOString(),
        },
    );
    return visit;
}
