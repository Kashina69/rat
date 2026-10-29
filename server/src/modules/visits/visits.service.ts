import { db } from "../../config/db.js";
import { emitToRooms, getIo, roomsForSheds } from "../../config/socket.js";
import type { RequestUser } from "../../types/domain.js";
import { writeAudit } from "../../utils/audit.js";
import { ApiError } from "../../utils/errors.js";
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

    const full = await db.visit.findUniqueOrThrow({
        where: { id: created.id },
        include: visitInclude,
    });
    const at = new Date().toISOString();
    const rooms = roomsForSheds(
        full.requirementLines.map((line) => line.shed.code),
    );
    emitToRooms(getIo(), rooms, "requirement.created", {
        visitId: full.id,
        at,
    });
    emitToRooms(getIo(), rooms, "visit.statusChanged", {
        visitId: full.id,
        status: full.status,
        at,
    });
    return { visit: toVisitDto(full), warnings };
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
        await tx.$queryRaw<Array<{ id: number }>>`
            SELECT id FROM visits WHERE id = ${visitId} FOR UPDATE
        `;
        const current = await tx.visit.findUnique({
            where: { id: visitId },
            include: { requirementLines: true },
        });
        if (!current) {
            throw new ApiError("VISIT_NOT_FOUND", "Visit not found", 404);
        }
        if (current.status === "CHECKED_OUT") {
            throw new ApiError(
                "ALREADY_CHECKED_OUT",
                "Visit already checked out",
                409,
            );
        }
        if (current.status === "CANCELLED") {
            throw new ApiError(
                "ALREADY_CANCELLED",
                "Visit already cancelled",
                409,
            );
        }
        if (current.requirementLines.some((line) => line.status === "LOADED")) {
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
    const line = await db.$transaction(async (tx) => {
        const existing = await tx.requirementLine.findUnique({
            where: { id: lineId },
        });
        if (!existing) {
            throw new ApiError("LINE_NOT_FOUND", "Line not found", 404);
        }
        await tx.$queryRaw<Array<{ id: number }>>`
            SELECT id FROM visits WHERE id = ${existing.visitId} FOR UPDATE
        `;
        const visit = await tx.visit.findUnique({
            where: { id: existing.visitId },
        });
        if (!visit) {
            throw new ApiError("VISIT_NOT_FOUND", "Visit not found", 404);
        }
        if (visit.status === "CHECKED_OUT" || visit.status === "CANCELLED") {
            throw new ApiError("VISIT_CLOSED", "Visit is already closed", 409);
        }
        await tx.$queryRaw<Array<{ id: number }>>`
            SELECT id FROM requirement_lines WHERE id = ${lineId} FOR UPDATE
        `;
        const locked = await tx.requirementLine.findUnique({
            where: { id: lineId },
        });
        if (!locked || locked.status !== "PENDING") {
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
        const statuses = await tx.requirementLine.findMany({
            where: { visitId: existing.visitId },
            select: { status: true },
        });
        const next = recalcVisitStatus(statuses.map((row) => row.status));
        await tx.visit.update({
            where: { id: existing.visitId },
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
        return full;
    });
    const dto = toLineDto(line);
    const at = new Date().toISOString();
    const visit = await db.visit.findUnique({
        where: { id: dto.visitId },
        select: { status: true },
    });
    emitToRooms(
        getIo(),
        roomsForSheds([(dto.shed as { code: string }).code]),
        "visit.statusChanged",
        { visitId: dto.visitId, status: visit?.status ?? null, at },
    );
    return dto;
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
    const line = await db.$transaction(async (tx) => {
        const existing = await tx.requirementLine.findUnique({
            where: { id: lineId },
        });
        if (!existing) {
            throw new ApiError("LINE_NOT_FOUND", "Line not found", 404);
        }
        if (
            user.role === "SHED" &&
            user.shedId !== null &&
            existing.shedId !== user.shedId
        ) {
            throw new ApiError(
                "CROSS_SHED",
                "Cannot confirm lines of another shed",
                403,
            );
        }
        await tx.$queryRaw<Array<{ id: number }>>`
            SELECT id FROM visits WHERE id = ${existing.visitId} FOR UPDATE
        `;
        const visit = await tx.visit.findUnique({
            where: { id: existing.visitId },
        });
        if (!visit) {
            throw new ApiError("VISIT_NOT_FOUND", "Visit not found", 404);
        }
        if (visit.status === "CHECKED_OUT") {
            throw new ApiError(
                "VISIT_CHECKED_OUT",
                "Visit already checked out",
                409,
            );
        }
        if (visit.status === "CANCELLED") {
            throw new ApiError("VISIT_CANCELLED", "Visit is cancelled", 409);
        }
        await tx.$queryRaw<Array<{ id: number }>>`
            SELECT id FROM requirement_lines WHERE id = ${lineId} FOR UPDATE
        `;
        const locked = await tx.requirementLine.findUnique({
            where: { id: lineId },
        });
        if (!locked) {
            throw new ApiError("LINE_NOT_FOUND", "Line not found", 404);
        }
        if (
            user.role === "SHED" &&
            user.shedId !== null &&
            locked.shedId !== user.shedId
        ) {
            throw new ApiError(
                "CROSS_SHED",
                "Cannot confirm lines of another shed",
                403,
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
        await tx.$queryRaw<Array<{ id: number }>>`
            SELECT id FROM items WHERE id = ${locked.itemId} FOR UPDATE
        `;
        const item = await tx.item.findUnique({
            where: { id: locked.itemId },
        });
        if (!item) {
            throw new ApiError("ITEM_NOT_FOUND", "Item not found", 404);
        }
        if (!item.isActive) {
            throw new ApiError("ITEM_INACTIVE", "Item is archived", 409);
        }
        if (item.currentStock < loadedQty) {
            throw new ApiError(
                "INSUFFICIENT_STOCK",
                `Only ${item.currentStock} in stock`,
                409,
            );
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
                visitId: existing.visitId,
                actorUserId: user.id,
                type: "OUT",
                delta: -loadedQty,
                balanceAfter,
            },
        });
        const statuses = await tx.requirementLine.findMany({
            where: { visitId: existing.visitId },
            select: { status: true },
        });
        const next = recalcVisitStatus(statuses.map((row) => row.status));
        await tx.visit.update({
            where: { id: existing.visitId },
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
        return full;
    });
    const dto = toLineDto(line);
    const at = new Date().toISOString();
    const confirmedVisit = await db.visit.findUnique({
        where: { id: dto.visitId },
        include: {
            requirementLines: {
                select: { shed: { select: { code: true } } },
            },
        },
    });
    const confirmedRooms = roomsForSheds([
        (dto.shed as { code: string }).code,
        ...(confirmedVisit?.requirementLines.map((row) => row.shed.code) ?? []),
    ]);
    emitToRooms(getIo(), confirmedRooms, "loading.confirmed", {
        lineId: dto.id,
        visitId: dto.visitId,
        itemId: dto.itemId,
        at,
    });
    emitToRooms(getIo(), confirmedRooms, "visit.statusChanged", {
        visitId: dto.visitId,
        status: confirmedVisit?.status ?? null,
        at,
    });
    emitToRooms(getIo(), confirmedRooms, "stock.updated", {
        itemId: dto.itemId,
        at,
    });
    emitToRooms(getIo(), confirmedRooms, "inventory.changed", {
        itemId: dto.itemId,
        at,
    });
    return dto;
}

export async function checkoutVisit(visitId: number, userId: number) {
    const visit = await db.$transaction(async (tx) => {
        await tx.$queryRaw<Array<{ id: number }>>`
            SELECT id FROM visits WHERE id = ${visitId} FOR UPDATE
        `;
        const current = await tx.visit.findUnique({
            where: { id: visitId },
            include: { requirementLines: true },
        });
        if (!current) {
            throw new ApiError("VISIT_NOT_FOUND", "Visit not found", 404);
        }
        if (current.status === "CHECKED_OUT") {
            throw new ApiError(
                "ALREADY_CHECKED_OUT",
                "Visit already checked out",
                409,
            );
        }
        if (current.status === "CANCELLED") {
            throw new ApiError("VISIT_CANCELLED", "Visit is cancelled", 409);
        }
        if (
            current.requirementLines.some((line) => line.status === "PENDING")
        ) {
            throw new ApiError(
                "NOT_READY",
                "All lines must be loaded before checkout",
                409,
            );
        }
        if (
            !current.requirementLines.some((line) => line.status === "LOADED")
        ) {
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
        return full;
    });
    const dto = toVisitDto(visit);
    emitToRooms(
        getIo(),
        roomsForSheds(dto.lines.map((line) => line.shed.code)),
        "visit.statusChanged",
        { visitId: dto.id, status: dto.status, at: new Date().toISOString() },
    );
    return dto;
}
