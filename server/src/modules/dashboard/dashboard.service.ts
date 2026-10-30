import type { Prisma, VisitStatus } from "@prisma/client";
import { db } from "../../config/db.js";
import type { RequestUser } from "../../types/domain.js";
import { ApiError } from "../../utils/errors.js";

const closedStatuses: VisitStatus[] = ["CHECKED_OUT", "CANCELLED"];

function shedScope(caller: RequestUser): number | null {
    if (caller.role !== "SHED") {
        return null;
    }
    if (caller.shedId === null) {
        throw new ApiError(
            "CROSS_SHED",
            "Shed user is not linked to a shed",
            403,
        );
    }
    return caller.shedId;
}

export async function getDashboard(caller: RequestUser) {
    const ownShedId = shedScope(caller);
    const insideVisit: Prisma.VisitWhereInput = {
        status: { notIn: closedStatuses },
    };
    if (ownShedId !== null) {
        insideVisit.requirementLines = { some: { shedId: ownShedId } };
    }
    const [insideCount, pendingLines, lowStock] = await db.$transaction([
        db.visit.count({ where: insideVisit }),
        db.requirementLine.findMany({
            where: {
                status: "PENDING",
                ...(ownShedId !== null ? { shedId: ownShedId } : {}),
                visit: { status: { notIn: closedStatuses } },
            },
            select: { shedId: true },
        }),
        db.item.findMany({
            where: {
                isActive: true,
                ...(ownShedId !== null ? { shedId: ownShedId } : {}),
            },
            include: { shed: true },
            orderBy: { currentStock: "asc" },
        }),
    ]);
    const counts = new Map<number, number>();
    for (const line of pendingLines) {
        counts.set(line.shedId, (counts.get(line.shedId) ?? 0) + 1);
    }
    const shedIds = [...counts.keys()];
    const sheds = await db.shed.findMany({
        where: { id: { in: shedIds } },
    });
    const shedById = new Map(sheds.map((shed) => [shed.id, shed]));
    return {
        insideCount,
        perShedPending: [...counts.entries()].map(([shedId, count]) => ({
            shedId,
            shedCode: shedById.get(shedId)?.code ?? null,
            shedName: shedById.get(shedId)?.name ?? null,
            pendingLines: count,
        })),
        lowStock: lowStock
            .filter((item) => item.currentStock <= item.reorderLevel)
            .map((item) => ({
                id: item.id,
                name: item.name,
                category: item.category,
                unit: item.unit,
                currentStock: item.currentStock,
                reorderLevel: item.reorderLevel,
                shed: item.shed,
            })),
    };
}
