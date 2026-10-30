import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { confirmLine } from "../src/modules/visits/visits.service.js";
import {
    makeItem,
    makeShed,
    makeUser,
    makeVisitWithLines,
} from "./factories.js";
import {
    assertLedgerInvariant,
    ledgerSum,
    migrateTestDb,
    prisma,
    truncateAll,
} from "./setup.js";

beforeAll(async () => {
    await migrateTestDb();
}, 120_000);

afterAll(async () => {
    await prisma.$disconnect();
});

beforeEach(async () => {
    await truncateAll();
});

test("SUM(delta) == currentStock across stock-in, confirm, adjust", async () => {
    const shed = await makeShed();
    const shedUser = await makeUser("SHED", shed.id);
    const admin = await makeUser("ADMIN");
    const gate = await makeUser("GATE");
    const item = await makeItem(shed.id, { currentStock: 100 });
    const requestUser = {
        id: shedUser.id,
        role: "SHED" as const,
        shedId: shed.id,
        shedCode: shed.code,
    };

    await prisma.stockLedger.create({
        data: {
            itemId: item.id,
            actorUserId: admin.id,
            type: "IN",
            delta: 25,
            balanceAfter: 125,
            reason: "restock",
        },
    });
    await prisma.item.update({
        where: { id: item.id },
        data: { currentStock: 125 },
    });

    const visit = await makeVisitWithLines(gate.id, [
        { itemId: item.id, shedId: shed.id, qty: 30 },
    ]);
    await confirmLine(visit.requirementLines[0].id, 30, requestUser);

    await prisma.stockLedger.create({
        data: {
            itemId: item.id,
            actorUserId: admin.id,
            type: "ADJUST",
            delta: -5,
            balanceAfter: 90,
            reason: "damage",
        },
    });
    await prisma.item.update({
        where: { id: item.id },
        data: { currentStock: 90 },
    });

    const sum = await ledgerSum(item.id);
    expect(sum).toBe(90);
    await assertLedgerInvariant([item.id]);
});
