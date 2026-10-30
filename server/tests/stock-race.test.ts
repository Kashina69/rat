import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { createApp } from "../src/app.js";
import { signToken } from "../src/utils/jwt.js";
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

let app: Express;
let shedToken = "";

beforeAll(async () => {
    await migrateTestDb();
    app = createApp();
}, 120_000);

afterAll(async () => {
    await prisma.$disconnect();
});

beforeEach(async () => {
    await truncateAll();
});

test("competing visits over limited stock: both confirms succeed, stock goes negative", async () => {
    const shed = await makeShed();
    const shedUser = await makeUser("SHED", shed.id);
    shedToken = signToken({
        userId: shedUser.id,
        role: "SHED",
        shedCode: shed.code,
    });
    const gate = await makeUser("GATE");
    const item = await makeItem(shed.id, { currentStock: 10 });
    const visitA = await makeVisitWithLines(gate.id, [
        { itemId: item.id, shedId: shed.id, qty: 8 },
    ]);
    const visitB = await makeVisitWithLines(gate.id, [
        { itemId: item.id, shedId: shed.id, qty: 8 },
    ]);

    const results = await Promise.allSettled([
        request(app)
            .post(
                `/api/requirement-lines/${visitA.requirementLines[0].id}/confirm`,
            )
            .set("Authorization", `Bearer ${shedToken}`)
            .send({ loadedQty: 8 }),
        request(app)
            .post(
                `/api/requirement-lines/${visitB.requirementLines[0].id}/confirm`,
            )
            .set("Authorization", `Bearer ${shedToken}`)
            .send({ loadedQty: 8 }),
    ]);

    for (const result of results) {
        expect(result.status).toBe("fulfilled");
        if (result.status !== "fulfilled") {
            continue;
        }
        expect(result.value.status).toBe(200);
        expect(result.value.body.error).toBeUndefined();
        expect(result.value.body.data.status).toBe("LOADED");
        expect(result.value.body.data.loadedQty).toBe(8);
    }

    const updated = await prisma.item.findUniqueOrThrow({
        where: { id: item.id },
    });
    expect(updated.currentStock).toBe(-6);
    expect(updated.currentStock).toBe(10 - 8 - 8);

    const outs = await prisma.stockLedger.findMany({
        where: { itemId: item.id, type: "OUT" },
        orderBy: { id: "asc" },
    });
    expect(outs).toHaveLength(2);
    expect(outs.map((row) => row.delta)).toEqual([-8, -8]);

    const sum = await ledgerSum(item.id);
    expect(sum).toBe(updated.currentStock);
    await assertLedgerInvariant([item.id]);
});

test("over-stock confirm succeeds, deducts the requested qty and one OUT row", async () => {
    const shed = await makeShed();
    const shedUser = await makeUser("SHED", shed.id);
    const token = signToken({
        userId: shedUser.id,
        role: "SHED",
        shedCode: shed.code,
    });
    const gate = await makeUser("GATE");
    const before = 3;
    const requested = 5;
    const item = await makeItem(shed.id, { currentStock: before });
    const visit = await makeVisitWithLines(gate.id, [
        { itemId: item.id, shedId: shed.id, qty: requested },
    ]);

    const res = await request(app)
        .post(`/api/requirement-lines/${visit.requirementLines[0].id}/confirm`)
        .set("Authorization", `Bearer ${token}`)
        .send({ loadedQty: requested });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("LOADED");
    expect(res.body.data.loadedQty).toBe(requested);

    const updated = await prisma.item.findUniqueOrThrow({
        where: { id: item.id },
    });
    expect(updated.currentStock).toBe(before - requested);
    expect(updated.currentStock).toBe(-2);

    const outs = await prisma.stockLedger.findMany({
        where: { itemId: item.id, type: "OUT" },
    });
    expect(outs).toHaveLength(1);
    expect(outs[0].delta).toBe(-requested);
    expect(outs[0].balanceAfter).toBe(-2);

    const sum = await ledgerSum(item.id);
    expect(sum).toBe(updated.currentStock);
    await assertLedgerInvariant([item.id]);
});

test("loadedQty above the requested quantity returns 400 without deduction", async () => {
    const shed = await makeShed();
    const shedUser = await makeUser("SHED", shed.id);
    const token = signToken({
        userId: shedUser.id,
        role: "SHED",
        shedCode: shed.code,
    });
    const gate = await makeUser("GATE");
    const item = await makeItem(shed.id, { currentStock: 10 });
    const visit = await makeVisitWithLines(gate.id, [
        { itemId: item.id, shedId: shed.id, qty: 4 },
    ]);

    const res = await request(app)
        .post(`/api/requirement-lines/${visit.requirementLines[0].id}/confirm`)
        .set("Authorization", `Bearer ${token}`)
        .send({ loadedQty: 5 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_QTY");

    const updated = await prisma.item.findUniqueOrThrow({
        where: { id: item.id },
    });
    expect(updated.currentStock).toBe(10);

    const outs = await prisma.stockLedger.findMany({
        where: { itemId: item.id, type: "OUT" },
    });
    expect(outs).toHaveLength(0);
    await assertLedgerInvariant([item.id]);
});

test("pending line of an archived item can still be confirmed", async () => {
    const shed = await makeShed();
    const shedUser = await makeUser("SHED", shed.id);
    const token = signToken({
        userId: shedUser.id,
        role: "SHED",
        shedCode: shed.code,
    });
    const gate = await makeUser("GATE");
    const item = await makeItem(shed.id, {
        currentStock: 10,
        isActive: false,
    });
    const visit = await makeVisitWithLines(gate.id, [
        { itemId: item.id, shedId: shed.id, qty: 4 },
    ]);

    const res = await request(app)
        .post(`/api/requirement-lines/${visit.requirementLines[0].id}/confirm`)
        .set("Authorization", `Bearer ${token}`)
        .send({ loadedQty: 4 });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("LOADED");

    const updated = await prisma.item.findUniqueOrThrow({
        where: { id: item.id },
    });
    expect(updated.currentStock).toBe(6);
    expect(updated.isActive).toBe(false);

    const outs = await prisma.stockLedger.findMany({
        where: { itemId: item.id, type: "OUT" },
    });
    expect(outs).toHaveLength(1);
    expect(outs[0].delta).toBe(-4);
    await assertLedgerInvariant([item.id]);
});
