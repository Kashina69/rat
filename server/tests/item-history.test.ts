import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { createApp } from "../src/app.js";
import { signToken } from "../src/utils/jwt.js";
import { makeItem, makeShed, makeUser } from "./factories.js";
import {
    assertLedgerInvariant,
    ledgerSum,
    migrateTestDb,
    prisma,
    truncateAll,
} from "./setup.js";

let app: Express;
let adminId = 0;
let adminToken = "";

beforeAll(async () => {
    await migrateTestDb();
    app = createApp();
}, 120_000);

afterAll(async () => {
    await prisma.$disconnect();
});

beforeEach(async () => {
    await truncateAll();
    const admin = await makeUser("ADMIN");
    adminId = admin.id;
    adminToken = signToken({ userId: admin.id, role: "ADMIN" });
});

function authorize(builder: request.Test) {
    return builder.set("Authorization", `Bearer ${adminToken}`);
}

test("rename and recategorise succeed after stock history and write an audit row", async () => {
    const shed = await makeShed();
    const created = await authorize(request(app).post("/api/items")).send({
        name: "Boxed rounds",
        category: "Ammo",
        unit: "box",
        shedId: shed.id,
        currentStock: 40,
        reorderLevel: 5,
    });
    expect(created.status).toBe(201);
    const itemId = created.body.data.id as number;
    expect(created.body.data.name).toBe("Boxed rounds");

    const opening = await prisma.stockLedger.findMany({ where: { itemId } });
    expect(opening).toHaveLength(1);
    expect(opening[0].type).toBe("OPENING");
    expect(opening[0].delta).toBe(40);
    expect(opening[0].balanceAfter).toBe(40);

    const restocked = await authorize(
        request(app).post(`/api/items/${itemId}/stock-in`),
    ).send({ qty: 10, reason: "restock" });
    expect(restocked.status).toBe(200);
    expect(restocked.body.data.currentStock).toBe(50);

    const renamed = await authorize(
        request(app).put(`/api/items/${itemId}`),
    ).send({ name: "Loose rounds", category: "Pyrotechnics" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.name).toBe("Loose rounds");
    expect(renamed.body.data.category).toBe("Pyrotechnics");
    expect(renamed.body.data.unit).toBe("box");
    expect(renamed.body.data.shedId).toBe(shed.id);
    expect(renamed.body.data.currentStock).toBe(50);

    const audits = await prisma.auditEvent.findMany({
        where: { entity: "Item", entityId: String(itemId) },
        orderBy: { id: "asc" },
        select: { action: true, userId: true },
    });
    expect(audits.map((row) => row.action)).toEqual([
        "ITEM_CREATED",
        "STOCK_IN",
        "ITEM_UPDATED",
    ]);
    expect([...new Set(audits.map((row) => row.userId))]).toEqual([adminId]);

    const ledgerRows = await prisma.stockLedger.findMany({
        where: { itemId },
        orderBy: { id: "asc" },
        select: { type: true, delta: true, balanceAfter: true },
    });
    expect(ledgerRows).toEqual([
        { type: "OPENING", delta: 40, balanceAfter: 40 },
        { type: "IN", delta: 10, balanceAfter: 50 },
    ]);
    expect(await ledgerSum(itemId)).toBe(50);

    const scanned = await assertLedgerInvariant();
    expect(scanned.checked).toBe(1);
});

test("a stock adjustment of zero is rejected and never reaches the ledger", async () => {
    const shed = await makeShed();
    const item = await makeItem(shed.id, { currentStock: 40 });

    const rejected = await authorize(
        request(app).post(`/api/items/${item.id}/adjust`),
    ).send({ qty: 0, reason: "no-op" });
    expect(rejected.status).toBe(400);
    expect(rejected.body.error.code).toBe("VALIDATION_ERROR");
    expect(rejected.body.error.message).toBe("qty must not be 0");

    const unchanged = await prisma.item.findUniqueOrThrow({
        where: { id: item.id },
    });
    expect(unchanged.currentStock).toBe(40);

    const ledgerRows = await prisma.stockLedger.findMany({
        where: { itemId: item.id },
    });
    expect(ledgerRows).toHaveLength(1);
    expect(ledgerRows[0].type).toBe("OPENING");
    expect(await ledgerSum(item.id)).toBe(40);
});
