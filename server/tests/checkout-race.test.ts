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
let gateToken = "";
let gateUserId = 0;

beforeAll(async () => {
    await migrateTestDb();
    app = createApp();
}, 120_000);

afterAll(async () => {
    await prisma.$disconnect();
});

beforeEach(async () => {
    await truncateAll();
    const gate = await makeUser("GATE");
    gateUserId = gate.id;
    gateToken = signToken({ userId: gate.id, role: "GATE" });
});

test("duplicate checkout: one transition, one 409, single audit", async () => {
    const shed = await makeShed();
    await makeUser("SHED", shed.id);
    const item = await makeItem(shed.id, { currentStock: 100 });
    const visit = await makeVisitWithLines(gateUserId, [
        { itemId: item.id, shedId: shed.id, qty: 10 },
    ]);
    await prisma.requirementLine.updateMany({
        where: { visitId: visit.id },
        data: { status: "LOADED", loadedQty: 10 },
    });
    await prisma.visit.update({
        where: { id: visit.id },
        data: { status: "READY_FOR_CHECKOUT" },
    });

    const results = await Promise.allSettled([
        request(app)
            .post(`/api/visits/${visit.id}/checkout`)
            .set("Authorization", `Bearer ${gateToken}`),
        request(app)
            .post(`/api/visits/${visit.id}/checkout`)
            .set("Authorization", `Bearer ${gateToken}`),
    ]);

    const statuses = results.map((r) =>
        r.status === "fulfilled" ? r.value.status : "REJECTED",
    );
    expect(statuses).toContain(200);
    expect(statuses).toContain(409);

    const updated = await prisma.visit.findUniqueOrThrow({
        where: { id: visit.id },
    });
    expect(updated.status).toBe("CHECKED_OUT");

    const audits = await prisma.auditEvent.findMany({
        where: { action: "VISIT_CHECKOUT", entityId: String(visit.id) },
    });
    expect(audits).toHaveLength(1);
});
