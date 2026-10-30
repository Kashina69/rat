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

test("competing visits over limited stock: no negative balance", async () => {
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

    const statuses = results.map((r) =>
        r.status === "fulfilled" ? r.value.status : "REJECTED",
    );
    expect(statuses).toContain(200);
    expect(statuses).toContain(409);

    const updated = await prisma.item.findUniqueOrThrow({
        where: { id: item.id },
    });
    expect(updated.currentStock).toBeGreaterThanOrEqual(0);

    const outs = await prisma.stockLedger.findMany({
        where: { itemId: item.id, type: "OUT" },
    });
    expect(outs).toHaveLength(1);

    await assertLedgerInvariant([item.id]);
});

test("insufficient stock confirm returns 409 without deduction", async () => {
    const shed = await makeShed();
    const shedUser = await makeUser("SHED", shed.id);
    const token = signToken({
        userId: shedUser.id,
        role: "SHED",
        shedCode: shed.code,
    });
    const gate = await makeUser("GATE");
    const item = await makeItem(shed.id, { currentStock: 3 });
    const visit = await makeVisitWithLines(gate.id, [
        { itemId: item.id, shedId: shed.id, qty: 5 },
    ]);

    const res = await request(app)
        .post(`/api/requirement-lines/${visit.requirementLines[0].id}/confirm`)
        .set("Authorization", `Bearer ${token}`)
        .send({ loadedQty: 5 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INSUFFICIENT_STOCK");

    const updated = await prisma.item.findUniqueOrThrow({
        where: { id: item.id },
    });
    expect(updated.currentStock).toBe(3);
    await assertLedgerInvariant([item.id]);
});
