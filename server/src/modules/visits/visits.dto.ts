import type { Prisma } from "@prisma/client";

export const lineInclude = {
    item: { include: { shed: true } },
    shed: true,
    confirmedByUser: {
        select: { id: true, name: true, username: true },
    },
} satisfies Prisma.RequirementLineInclude;

export type LineRow = Prisma.RequirementLineGetPayload<{
    include: typeof lineInclude;
}>;

export const visitInclude = {
    gateUser: { select: { id: true, name: true, username: true } },
    checkoutByUser: {
        select: { id: true, name: true, username: true },
    },
    requirementLines: { include: lineInclude, orderBy: { id: "asc" } },
} satisfies Prisma.VisitInclude;

export type VisitRow = Prisma.VisitGetPayload<{
    include: typeof visitInclude;
}>;

export type LineDisplay = "PENDING" | "FULL" | "SHORT" | "CANCELLED";

export function lineDisplay(
    status: LineRow["status"],
    requestedQty: number,
    loadedQty: number | null,
): LineDisplay {
    if (status === "PENDING") {
        return "PENDING";
    }
    if (status === "CANCELLED") {
        return "CANCELLED";
    }
    return (loadedQty ?? 0) >= requestedQty ? "FULL" : "SHORT";
}

export function lineShortfall(
    status: LineRow["status"],
    requestedQty: number,
    loadedQty: number | null,
): number | null {
    if (status !== "LOADED") {
        return null;
    }
    return requestedQty - (loadedQty ?? 0);
}

export function toLineDto(line: LineRow) {
    return {
        id: line.id,
        visitId: line.visitId,
        itemId: line.itemId,
        shedId: line.shedId,
        requestedQty: line.requestedQty,
        loadedQty: line.loadedQty,
        status: line.status,
        confirmedAt: line.confirmedAt,
        confirmedBy: line.confirmedByUser,
        item: {
            id: line.item.id,
            name: line.item.name,
            category: line.item.category,
            unit: line.item.unit,
            currentStock: line.item.currentStock,
            shed: line.item.shed,
        },
        shed: line.shed,
        shortfall: lineShortfall(
            line.status,
            line.requestedQty,
            line.loadedQty,
        ),
        display: lineDisplay(line.status, line.requestedQty, line.loadedQty),
    };
}

export function toVisitDto(visit: VisitRow) {
    return {
        id: visit.id,
        vehicleNumber: visit.vehicleNumber,
        driverName: visit.driverName,
        party: visit.party,
        status: visit.status,
        arrivalAt: visit.arrivalAt,
        checkoutAt: visit.checkoutAt,
        cancelledAt: visit.cancelledAt,
        gateUser: visit.gateUser,
        checkoutByUser: visit.checkoutByUser,
        lines: visit.requirementLines.map(toLineDto),
    };
}
