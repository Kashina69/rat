import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { adjustStock, stockIn } from "../src/modules/items/items.service.js";
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

test("SUM(delta) == currentStock for every item after stock-in, confirm, adjust", async () => {
    const shed = await makeShed();
    const otherShed = await makeShed();
    const shedUser = await makeUser("SHED", shed.id);
    const admin = await makeUser("ADMIN");
    const gate = await makeUser("GATE");
    const item = await makeItem(shed.id, { currentStock: 100 });
    const untouched = await makeItem(otherShed.id, { currentStock: 0 });
    const requestUser = {
        id: shedUser.id,
        role: "SHED" as const,
        shedId: shed.id,
        shedCode: shed.code,
    };

    await stockIn(item.id, { qty: 25, reason: "restock" }, admin.id);
    const visit = await makeVisitWithLines(gate.id, [
        { itemId: item.id, shedId: shed.id, qty: 30 },
    ]);
    await confirmLine(visit.requirementLines[0].id, 30, requestUser);
    await adjustStock(item.id, { qty: -5, reason: "damage" }, admin.id);

    const updated = await prisma.item.findUniqueOrThrow({
        where: { id: item.id },
    });
    expect(updated.currentStock).toBe(90);
    expect(await ledgerSum(item.id)).toBe(90);

    const totalItems = await prisma.item.count();
    expect(totalItems).toBe(2);
    const { checked } = await assertLedgerInvariant();
    expect(checked).toBe(totalItems);
    expect(untouched.currentStock).toBe(0);
});

test("the scan covers every item, including drift the caller never mentioned", async () => {
    const shed = await makeShed();
    const healthy = await makeItem(shed.id, { currentStock: 40 });
    const drifted = await makeItem(shed.id, { currentStock: 40 });

    await prisma.item.update({
        where: { id: drifted.id },
        data: { currentStock: 30 },
    });

    expect(await ledgerSum(healthy.id)).toBe(40);
    expect(await ledgerSum(drifted.id)).toBe(40);

    await expect(assertLedgerInvariant()).rejects.toThrow(
        new RegExp(
            `Ledger invariant broken for 1 of 2 item\\(s\\).*item ${drifted.id}: SUM\\(delta\\)=40 != currentStock=30`,
        ),
    );
});
