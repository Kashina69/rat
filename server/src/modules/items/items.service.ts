import { db } from "../../config/db.js";
import { writeAudit } from "../../utils/audit.js";
import { ApiError } from "../../utils/errors.js";
import type {
    AdjustStockInput,
    CreateItemInput,
    ListItemsQuery,
    StockInInput,
    UpdateItemInput,
} from "../../validators/item.schemas.js";

const itemInclude = {
    shed: true,
} as const;

function toItemDto(item: {
    id: number;
    name: string;
    category: string;
    unit: string;
    shedId: number;
    currentStock: number;
    reorderLevel: number;
    isActive: boolean;
    shed: unknown;
}) {
    return item;
}

export async function listItems(query: ListItemsQuery) {
    const items = await db.item.findMany({
        where: {
            ...(query.includeInactive ? {} : { isActive: true }),
            ...(query.shed ? { shed: { code: query.shed } } : {}),
        },
        include: itemInclude,
        orderBy: [{ shedId: "asc" }, { name: "asc" }],
    });
    return items.map(toItemDto);
}

export async function createItem(input: CreateItemInput, userId: number) {
    const shed = await db.shed.findUnique({
        where: { id: input.shedId },
    });
    if (!shed) {
        throw new ApiError("SHED_NOT_FOUND", "Shed not found", 404);
    }
    const item = await db.$transaction(async (tx) => {
        const created = await tx.item.create({
            data: {
                name: input.name,
                category: input.category,
                unit: input.unit,
                shedId: input.shedId,
                currentStock: input.currentStock,
                reorderLevel: input.reorderLevel,
            },
            include: itemInclude,
        });
        await tx.stockLedger.create({
            data: {
                itemId: created.id,
                actorUserId: userId,
                type: "OPENING",
                delta: created.currentStock,
                balanceAfter: created.currentStock,
                reason: "Opening stock",
            },
        });
        await writeAudit(tx, {
            userId,
            action: "ITEM_CREATED",
            entity: "Item",
            entityId: created.id,
        });
        return created;
    });
    return toItemDto(item);
}

async function getItemOrThrow(itemId: number) {
    const item = await db.item.findUnique({
        where: { id: itemId },
        include: itemInclude,
    });
    if (!item) {
        throw new ApiError("ITEM_NOT_FOUND", "Item not found", 404);
    }
    return item;
}

export async function updateItem(
    itemId: number,
    input: UpdateItemInput,
    userId: number,
) {
    const item = await getItemOrThrow(itemId);
    if (input.isActive === undefined) {
        const hasHistory = await db.stockLedger.findFirst({
            where: { itemId },
            select: { id: true },
        });
        if (hasHistory) {
            const forbidden =
                (input.name !== undefined && input.name !== item.name) ||
                (input.category !== undefined &&
                    input.category !== item.category);
            if (forbidden) {
                throw new ApiError(
                    "ITEM_HAS_HISTORY",
                    "Cannot rename item after transactions exist",
                    409,
                );
            }
        }
    }
    const updated = await db.$transaction(async (tx) => {
        if (input.isActive === false && item.isActive) {
            await tx.item.update({
                where: { id: itemId },
                data: { isActive: false },
            });
        } else {
            await tx.item.update({
                where: { id: itemId },
                data: {
                    ...(input.name !== undefined ? { name: input.name } : {}),
                    ...(input.category !== undefined
                        ? { category: input.category }
                        : {}),
                    ...(input.reorderLevel !== undefined
                        ? { reorderLevel: input.reorderLevel }
                        : {}),
                    ...(input.isActive !== undefined
                        ? { isActive: input.isActive }
                        : {}),
                },
            });
        }
        await writeAudit(tx, {
            userId,
            action:
                input.isActive === false && item.isActive
                    ? "ITEM_ARCHIVED"
                    : "ITEM_UPDATED",
            entity: "Item",
            entityId: itemId,
        });
        return tx.item.findUniqueOrThrow({
            where: { id: itemId },
            include: itemInclude,
        });
    });
    return toItemDto(updated);
}

export async function deleteItem(itemId: number, userId: number) {
    const item = await getItemOrThrow(itemId);
    const usage = await db.$transaction(async (tx) => {
        const line = await tx.requirementLine.findFirst({
            where: { itemId },
            select: { id: true },
        });
        const ledger = await tx.stockLedger.findFirst({
            where: { itemId },
            select: { id: true },
        });
        return { line, ledger };
    });
    if (usage.line || usage.ledger) {
        const archived = await db.$transaction(async (tx) => {
            await tx.item.update({
                where: { id: itemId },
                data: { isActive: false },
            });
            await writeAudit(tx, {
                userId,
                action: "ITEM_ARCHIVED",
                entity: "Item",
                entityId: itemId,
            });
            return tx.item.findUniqueOrThrow({
                where: { id: itemId },
                include: itemInclude,
            });
        });
        return { archived: true, item: toItemDto(archived) };
    }
    await db.$transaction(async (tx) => {
        await tx.item.delete({ where: { id: itemId } });
        await writeAudit(tx, {
            userId,
            action: "ITEM_DELETED",
            entity: "Item",
            entityId: itemId,
        });
    });
    return { archived: false, item: toItemDto(item) };
}

export async function stockIn(
    itemId: number,
    input: StockInInput,
    userId: number,
) {
    const item = await db.$transaction(async (tx) => {
        await tx.$queryRaw<Array<{ id: number }>>`
            SELECT id FROM items WHERE id = ${itemId} FOR UPDATE
        `;
        const current = await tx.item.findUnique({
            where: { id: itemId },
        });
        if (!current) {
            throw new ApiError("ITEM_NOT_FOUND", "Item not found", 404);
        }
        const balanceAfter = current.currentStock + input.qty;
        await tx.item.update({
            where: { id: itemId },
            data: { currentStock: balanceAfter },
        });
        await tx.stockLedger.create({
            data: {
                itemId,
                actorUserId: userId,
                type: "IN",
                delta: input.qty,
                balanceAfter,
                reason: input.reason ?? "Stock in",
            },
        });
        await writeAudit(tx, {
            userId,
            action: "STOCK_IN",
            entity: "Item",
            entityId: itemId,
        });
        return tx.item.findUniqueOrThrow({
            where: { id: itemId },
            include: itemInclude,
        });
    });
    return toItemDto(item);
}

export async function adjustStock(
    itemId: number,
    input: AdjustStockInput,
    userId: number,
) {
    const item = await db.$transaction(async (tx) => {
        await tx.$queryRaw<Array<{ id: number }>>`
            SELECT id FROM items WHERE id = ${itemId} FOR UPDATE
        `;
        const current = await tx.item.findUnique({
            where: { id: itemId },
        });
        if (!current) {
            throw new ApiError("ITEM_NOT_FOUND", "Item not found", 404);
        }
        const balanceAfter = current.currentStock + input.qty;
        if (balanceAfter < 0) {
            throw new ApiError(
                "NEGATIVE_STOCK",
                "Adjustment would drive stock below zero",
                409,
            );
        }
        await tx.item.update({
            where: { id: itemId },
            data: { currentStock: balanceAfter },
        });
        await tx.stockLedger.create({
            data: {
                itemId,
                actorUserId: userId,
                type: "ADJUST",
                delta: input.qty,
                balanceAfter,
                reason: input.reason,
            },
        });
        await writeAudit(tx, {
            userId,
            action: "STOCK_ADJUSTED",
            entity: "Item",
            entityId: itemId,
        });
        return tx.item.findUniqueOrThrow({
            where: { id: itemId },
            include: itemInclude,
        });
    });
    return toItemDto(item);
}
