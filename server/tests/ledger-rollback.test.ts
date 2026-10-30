import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { db } from "../src/config/db.js";
import { confirmLine } from "../src/modules/visits/visits.service.js";
import {
    makeItem,
    makeShed,
    makeUser,
    makeVisitWithLines,
} from "./factories.js";
import { migrateTestDb, prisma, truncateAll } from "./setup.js";

beforeAll(async () => {
    await migrateTestDb();
}, 120_000);

afterAll(async () => {
    await prisma.$disconnect();
});

beforeEach(async () => {
    await truncateAll();
});

test("forced ledger failure rolls back stock + line", async () => {
    const shed = await makeShed();
    const shedUser = await makeUser("SHED", shed.id);
    const gate = await makeUser("GATE");
    const item = await makeItem(shed.id, { currentStock: 50 });
    const visit = await makeVisitWithLines(gate.id, [
        { itemId: item.id, shedId: shed.id, qty: 10 },
    ]);
    const lineId = visit.requirementLines[0].id;

    await prisma.stockLedger.create({
        data: {
            itemId: item.id,
            requirementLineId: lineId,
            actorUserId: shedUser.id,
            type: "OUT",
            delta: -1,
            balanceAfter: 49,
            reason: "poisoned ledger row",
        },
    });

    await expect(
        confirmLine(lineId, 10, {
            id: shedUser.id,
            role: "SHED",
            shedId: shed.id,
            shedCode: shed.code,
        }),
    ).rejects.toThrow();

    const updated = await prisma.item.findUniqueOrThrow({
        where: { id: item.id },
    });
    expect(updated.currentStock).toBe(50);

    const line = await prisma.requirementLine.findUniqueOrThrow({
        where: { id: lineId },
    });
    expect(line.status).toBe("PENDING");

    const check = await db.item.findUnique({ where: { id: item.id } });
    expect(check?.currentStock).toBe(50);
});
