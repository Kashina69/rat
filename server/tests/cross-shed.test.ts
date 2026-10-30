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
import { migrateTestDb, prisma, truncateAll } from "./setup.js";

let app: Express;

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

test("cross-shed API confirm denied with 403, no state change", async () => {
    const shedA = await makeShed();
    const shedB = await makeShed();
    const userA = await makeUser("SHED", shedA.id);
    const gate = await makeUser("GATE");
    const tokenA = signToken({
        userId: userA.id,
        role: "SHED",
        shedCode: shedA.code,
    });
    const itemB = await makeItem(shedB.id, { currentStock: 100 });
    const visit = await makeVisitWithLines(gate.id, [
        { itemId: itemB.id, shedId: shedB.id, qty: 10 },
    ]);
    const lineId = visit.requirementLines[0].id;

    const res = await request(app)
        .post(`/api/requirement-lines/${lineId}/confirm`)
        .set("Authorization", `Bearer ${tokenA}`)
        .send({ loadedQty: 10 });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CROSS_SHED");

    const line = await prisma.requirementLine.findUniqueOrThrow({
        where: { id: lineId },
    });
    expect(line.status).toBe("PENDING");

    const item = await prisma.item.findUniqueOrThrow({
        where: { id: itemB.id },
    });
    expect(item.currentStock).toBe(100);
});
