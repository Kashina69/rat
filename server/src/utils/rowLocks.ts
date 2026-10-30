import type { Prisma, RequirementLineStatus } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export interface LockedVisitRow {
    id: number;
    status: string;
}

export interface LockedLineRow {
    id: number;
    visitId: number;
    itemId: number;
    shedId: number;
    requestedQty: number;
    loadedQty: number | null;
    status: string;
}

export interface LockedItemRow {
    id: number;
    shedId: number;
    currentStock: number;
    isActive: boolean;
}

export async function lockVisitForUpdate(
    tx: Tx,
    visitId: number,
): Promise<LockedVisitRow | null> {
    const rows = await tx.$queryRaw<LockedVisitRow[]>`
        SELECT id, status FROM visits WHERE id = ${visitId} FOR UPDATE
    `;
    return rows[0] ?? null;
}

export async function lockLineForUpdate(
    tx: Tx,
    lineId: number,
): Promise<LockedLineRow | null> {
    const rows = await tx.$queryRaw<LockedLineRow[]>`
        SELECT id, visitId, itemId, shedId, requestedQty, loadedQty, status
        FROM requirement_lines WHERE id = ${lineId} FOR UPDATE
    `;
    return rows[0] ?? null;
}

export async function lockItemForUpdate(
    tx: Tx,
    itemId: number,
): Promise<LockedItemRow | null> {
    const rows = await tx.$queryRaw<LockedItemRow[]>`
        SELECT id, shedId, currentStock, isActive
        FROM items WHERE id = ${itemId} FOR UPDATE
    `;
    return rows[0] ?? null;
}

export async function lockVisitLinesForUpdate(
    tx: Tx,
    visitId: number,
): Promise<LockedLineRow[]> {
    return tx.$queryRaw<LockedLineRow[]>`
        SELECT id, visitId, itemId, shedId, requestedQty, loadedQty, status
        FROM requirement_lines WHERE visitId = ${visitId} FOR UPDATE
    `;
}

export async function lockLineStatusesForUpdate(
    tx: Tx,
    visitId: number,
): Promise<RequirementLineStatus[]> {
    const rows = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT status FROM requirement_lines WHERE visitId = ${visitId} FOR UPDATE
    `;
    return rows.map((row) => row.status as RequirementLineStatus);
}
