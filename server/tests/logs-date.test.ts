import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { createApp } from "../src/app.js";
import { listLogs } from "../src/modules/logs/logs.service.js";
import { istDayEndUtc, istDayStartUtc } from "../src/utils/datetime.js";
import { signToken } from "../src/utils/jwt.js";
import {
    makeItem,
    makeShed,
    makeUser,
    makeVisitWithLines,
} from "./factories.js";
import { migrateTestDb, prisma, truncateAll } from "./setup.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

test("a calendar day maps to its IST midnight window", () => {
    const start = istDayStartUtc("2026-10-30");
    const end = istDayEndUtc("2026-10-30");

    expect(start.toISOString()).toBe("2026-10-29T18:30:00.000Z");
    expect(end.toISOString()).toBe("2026-10-30T18:29:59.999Z");
    expect(end.getTime() - start.getTime()).toBe(MS_PER_DAY - 1);
});

test("month, year and leap-day boundaries stay on the IST offset", () => {
    expect(istDayStartUtc("2026-01-01").toISOString()).toBe(
        "2025-12-31T18:30:00.000Z",
    );
    expect(istDayEndUtc("2026-01-01").toISOString()).toBe(
        "2026-01-01T18:29:59.999Z",
    );
    expect(istDayStartUtc("2024-03-01").toISOString()).toBe(
        "2024-02-29T18:30:00.000Z",
    );
    expect(istDayEndUtc("2024-03-01").toISOString()).toBe(
        "2024-03-01T18:29:59.999Z",
    );
});

test("values that are not YYYY-MM-DD fall back to instant parsing", () => {
    const instant = "2026-10-30T00:00:00.000Z";
    expect(istDayStartUtc(instant).toISOString()).toBe(instant);
    expect(istDayEndUtc(instant).toISOString()).toBe(instant);
});

test("from/to treat a visit at the IST day boundary as part of that IST day", async () => {
    const shed = await makeShed();
    const gate = await makeUser("GATE");
    const item = await makeItem(shed.id);

    const firstIstInstantOfDay = new Date("2026-10-29T18:30:00.000Z");
    const lastIstInstantOfDay = new Date("2026-10-30T18:29:59.999Z");
    const firstVisit = await makeVisitWithLines(
        gate.id,
        [{ itemId: item.id, shedId: shed.id, qty: 1 }],
        { arrivalAt: firstIstInstantOfDay },
    );
    const lastVisit = await makeVisitWithLines(
        gate.id,
        [{ itemId: item.id, shedId: shed.id, qty: 2 }],
        { arrivalAt: lastIstInstantOfDay },
    );

    const thatDay = await listLogs({
        from: "2026-10-30",
        to: "2026-10-30",
        page: 1,
        limit: 50,
    });
    expect(thatDay.pagination.totalItems).toBe(2);
    expect(thatDay.rows.map((row) => row.lineId).sort((a, b) => a - b)).toEqual(
        [
            firstVisit.requirementLines[0].id,
            lastVisit.requirementLines[0].id,
        ].sort((a, b) => a - b),
    );
    expect(istDayStartUtc("2026-10-30").getTime()).toBe(
        firstIstInstantOfDay.getTime(),
    );

    const nextIstDay = await listLogs({
        from: "2026-10-31",
        page: 1,
        limit: 50,
    });
    expect(nextIstDay.pagination.totalItems).toBe(0);

    const previousIstDay = await listLogs({
        to: "2026-10-29",
        page: 1,
        limit: 50,
    });
    expect(previousIstDay.pagination.totalItems).toBe(0);
});

test("GET /api/logs applies the IST day window to from/to", async () => {
    const shed = await makeShed();
    const admin = await makeUser("ADMIN");
    const gate = await makeUser("GATE");
    const token = signToken({ userId: admin.id, role: "ADMIN" });
    const item = await makeItem(shed.id);

    const lastIstInstantOfDay = new Date("2026-10-30T18:29:59.999Z");
    const nextIstDayInstant = new Date("2026-10-31T02:00:00.000Z");
    const inDay = await makeVisitWithLines(
        gate.id,
        [{ itemId: item.id, shedId: shed.id, qty: 1 }],
        { arrivalAt: lastIstInstantOfDay },
    );
    await makeVisitWithLines(
        gate.id,
        [{ itemId: item.id, shedId: shed.id, qty: 2 }],
        { arrivalAt: nextIstDayInstant },
    );

    const res = await request(app)
        .get("/api/logs?from=2026-10-30&to=2026-10-30")
        .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.totalItems).toBe(1);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].lineId).toBe(inDay.requirementLines[0].id);
    expect(res.body.data[0].arrivalIST).toBe("2026-10-30 23:59:59");
});
