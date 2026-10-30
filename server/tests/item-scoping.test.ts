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

interface ScopedItem {
    id: number;
    shedId: number;
}

interface PendingShed {
    shedId: number;
    shedCode: string | null;
    pendingLines: number;
}

interface Dashboard {
    insideCount: number;
    perShedPending: PendingShed[];
    lowStock: Array<{ id: number; shed: { code: string } }>;
}

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

test("a SHED caller lists only its own shed's items", async () => {
    const shedA = await makeShed();
    const shedB = await makeShed();
    const userA = await makeUser("SHED", shedA.id);
    const token = signToken({
        userId: userA.id,
        role: "SHED",
        shedCode: shedA.code,
    });
    const ownItem = await makeItem(shedA.id);
    await makeItem(shedB.id);
    await makeItem(shedA.id, { isActive: false });

    const res = await request(app)
        .get("/api/items")
        .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const items = res.body.data as ScopedItem[];
    expect(items.map((item) => item.id)).toEqual([ownItem.id]);
    expect(items.every((item) => item.shedId === shedA.id)).toBe(true);

    const withInactive = await request(app)
        .get("/api/items?includeInactive=true")
        .set("Authorization", `Bearer ${token}`);
    expect(withInactive.status).toBe(200);
    const allOwnItems = withInactive.body.data as ScopedItem[];
    expect(allOwnItems).toHaveLength(2);
    expect(allOwnItems.every((item) => item.shedId === shedA.id)).toBe(true);
});

test("asking for another shed's items is 403 CROSS_SHED", async () => {
    const shedA = await makeShed();
    const shedB = await makeShed();
    const userA = await makeUser("SHED", shedA.id);
    const token = signToken({
        userId: userA.id,
        role: "SHED",
        shedCode: shedA.code,
    });
    const ownItem = await makeItem(shedA.id);
    await makeItem(shedB.id);

    const otherShed = await request(app)
        .get(`/api/items?shed=${shedB.code}`)
        .set("Authorization", `Bearer ${token}`);
    expect(otherShed.status).toBe(403);
    expect(otherShed.body.error.code).toBe("CROSS_SHED");

    const ownShed = await request(app)
        .get(`/api/items?shed=${shedA.code}`)
        .set("Authorization", `Bearer ${token}`);
    expect(ownShed.status).toBe(200);
    const items = ownShed.body.data as ScopedItem[];
    expect(items.map((item) => item.id)).toEqual([ownItem.id]);
});

test("the dashboard is scoped to the caller's shed", async () => {
    const shedA = await makeShed();
    const shedB = await makeShed();
    const userA = await makeUser("SHED", shedA.id);
    const admin = await makeUser("ADMIN");
    const gate = await makeUser("GATE");
    const shedAToken = signToken({
        userId: userA.id,
        role: "SHED",
        shedCode: shedA.code,
    });
    const adminToken = signToken({ userId: admin.id, role: "ADMIN" });

    const lowA = await makeItem(shedA.id, {
        currentStock: 2,
        reorderLevel: 5,
    });
    const highA = await makeItem(shedA.id, {
        currentStock: 100,
        reorderLevel: 10,
    });
    const lowB = await makeItem(shedB.id, {
        currentStock: 2,
        reorderLevel: 5,
    });

    const visitA = await makeVisitWithLines(gate.id, [
        { itemId: lowA.id, shedId: shedA.id, qty: 3 },
    ]);
    expect(visitA.status).toBe("AWAITING_LOADING");
    await makeVisitWithLines(gate.id, [
        { itemId: lowB.id, shedId: shedB.id, qty: 3 },
    ]);
    const closedVisit = await makeVisitWithLines(
        gate.id,
        [{ itemId: highA.id, shedId: shedA.id, qty: 3 }],
        { status: "CHECKED_OUT" },
    );
    expect(closedVisit.status).toBe("CHECKED_OUT");

    const shedDashboard = await request(app)
        .get("/api/dashboard")
        .set("Authorization", `Bearer ${shedAToken}`);
    expect(shedDashboard.status).toBe(200);
    const scoped = shedDashboard.body.data as Dashboard;
    expect(scoped.insideCount).toBe(1);
    expect(scoped.perShedPending).toEqual([
        {
            shedId: shedA.id,
            shedCode: shedA.code,
            shedName: shedA.name,
            pendingLines: 1,
        },
    ]);
    expect(scoped.lowStock.map((row) => row.id)).toEqual([lowA.id]);
    expect(scoped.lowStock.every((row) => row.shed.code === shedA.code)).toBe(
        true,
    );

    const adminDashboard = await request(app)
        .get("/api/dashboard")
        .set("Authorization", `Bearer ${adminToken}`);
    expect(adminDashboard.status).toBe(200);
    const depot = adminDashboard.body.data as Dashboard;
    expect(depot.insideCount).toBe(2);
    expect(
        depot.perShedPending.map((row) => row.shedId).sort((a, b) => a - b),
    ).toEqual([shedA.id, shedB.id].sort((a, b) => a - b));
    expect(depot.lowStock.map((row) => row.id).sort((a, b) => a - b)).toEqual(
        [lowA.id, lowB.id].sort((a, b) => a - b),
    );
});
