import { db } from "../../config/db.js";

export async function getDashboard() {
    const [insideCount, pendingLines, lowStock] = await db.$transaction([
        db.visit.count({
            where: { status: { notIn: ["CHECKED_OUT", "CANCELLED"] } },
        }),
        db.requirementLine.findMany({
            where: {
                status: "PENDING",
                visit: {
                    status: { notIn: ["CHECKED_OUT", "CANCELLED"] },
                },
            },
            select: { shedId: true },
        }),
        db.item.findMany({
            where: { isActive: true },
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
