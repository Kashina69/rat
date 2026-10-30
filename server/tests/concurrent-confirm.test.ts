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

test("two concurrent confirms of one line: one success, one 409, one deduction", async () => {
    const shed = await makeShed();
    const shedUser = await makeUser("SHED", shed.id);
    const gate = await makeUser("GATE");
    shedToken = signToken({
        userId: shedUser.id,
        role: "SHED",
        shedCode: shed.code,
    });
    const item = await makeItem(shed.id, { currentStock: 100 });
    const visit = await makeVisitWithLines(gate.id, [
        { itemId: item.id, shedId: shed.id, qty: 10 },
    ]);
    const lineId = visit.requirementLines[0].id;

    const results = await Promise.allSettled([
        request(app)
            .post(`/api/requirement-lines/${lineId}/confirm`)
            .set("Authorization", `Bearer ${shedToken}`)
            .send({ loadedQty: 10 }),
        request(app)
            .post(`/api/requirement-lines/${lineId}/confirm`)
            .set("Authorization", `Bearer ${shedToken}`)
            .send({ loadedQty: 10 }),
    ]);

    const statuses = results.map((r) =>
        r.status === "fulfilled" ? r.value.status : "REJECTED",
    );
    expect(statuses).toContain(200);
    expect(statuses).toContain(409);

    const failed = results.filter(
        (r): r is PromiseFulfilledResult<request.Response> =>
            r.status === "fulfilled" && r.value.status === 409,
    );
    expect(failed).toHaveLength(1);
    expect(failed[0].value.body.error.code).toBe("ALREADY_CONFIRMED");

    const updated = await prisma.item.findUniqueOrThrow({
        where: { id: item.id },
    });
    expect(updated.currentStock).toBe(90);

    const ledgers = await prisma.stockLedger.findMany({
        where: { itemId: item.id, type: "OUT" },
    });
    expect(ledgers).toHaveLength(1);
    expect(ledgers[0].delta).toBe(-10);

    await assertLedgerInvariant([item.id]);
});

test("concurrent confirms across sheds reach correct final status", async () => {
    const shedA = await makeShed();
    const userA = await makeUser("SHED", shedA.id);
    const tokenA = signToken({
        userId: userA.id,
        role: "SHED",
        shedCode: shedA.code,
    });
    const shedB = await makeShed();
    const shedBUser = await makeUser("SHED", shedB.id);
    const shedBToken = signToken({
        userId: shedBUser.id,
        role: "SHED",
        shedCode: shedB.code,
    });
    const itemA = await makeItem(shedA.id, { currentStock: 100 });
    const itemB = await makeItem(shedB.id, { currentStock: 100 });
    const gate = await makeUser("GATE");
    const visit = await makeVisitWithLines(gate.id, [
        { itemId: itemA.id, shedId: shedA.id, qty: 10 },
        { itemId: itemB.id, shedId: shedB.id, qty: 20 },
    ]);
    const [lineA, lineB] = visit.requirementLines;

    const results = await Promise.allSettled([
        request(app)
            .post(`/api/requirement-lines/${lineA.id}/confirm`)
            .set("Authorization", `Bearer ${tokenA}`)
            .send({ loadedQty: 10 }),
        request(app)
            .post(`/api/requirement-lines/${lineB.id}/confirm`)
            .set("Authorization", `Bearer ${shedBToken}`)
            .send({ loadedQty: 20 }),
    ]);
    for (const r of results) {
        expect(r.status).toBe("fulfilled");
        if (r.status === "fulfilled") {
            expect(r.value.status).toBe(200);
        }
    }

    const updated = await prisma.visit.findUniqueOrThrow({
        where: { id: visit.id },
    });
    expect(updated.status).toBe("READY_FOR_CHECKOUT");
    await assertLedgerInvariant([itemA.id, itemB.id]);
});
