import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { createApp } from "../src/app.js";
import { signToken } from "../src/utils/jwt.js";
import { makeShed, makeUser } from "./factories.js";
import { migrateTestDb, prisma, truncateAll } from "./setup.js";

let app: Express;
let adminToken = "";
let adminId = 0;

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

test("creates a user and never returns passwordHash", async () => {
    const shed = await makeShed();

    const res = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
            name: "Shed Keeper",
            username: "keeper",
            password: "Secret@123",
            role: "SHED",
            shedId: shed.id,
        });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
        name: "Shed Keeper",
        username: "keeper",
        role: "SHED",
        shedId: shed.id,
        isActive: true,
        shed: { code: shed.code, name: shed.name },
    });
    expect(res.body.data).not.toHaveProperty("passwordHash");

    const row = await prisma.user.findUniqueOrThrow({
        where: { username: "keeper" },
    });
    expect(row.passwordHash).not.toBe("Secret@123");
    expect(row.passwordHash.startsWith("$2")).toBe(true);

    const audits = await prisma.auditEvent.findMany({
        where: { action: "USER_CREATED", entity: "User" },
    });
    expect(audits).toHaveLength(1);
    expect(audits[0].entityId).toBe(String(res.body.data.id));

    const list = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(
        list.body.data.some(
            (user: { username: string }) => user.username === "keeper",
        ),
    ).toBe(true);
    expect(JSON.stringify(list.body)).not.toContain("passwordHash");
});

test("duplicate username returns 409 DUPLICATE", async () => {
    await makeUser("GATE", null, "taken-name");

    const res = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
            name: "Another Gate",
            username: "taken-name",
            password: "Secret@123",
            role: "GATE",
        });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE");
});

test("SHED role requires shedId and other roles forbid it", async () => {
    const shed = await makeShed();

    const missingShed = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
            name: "No Shed",
            username: "no-shed",
            password: "Secret@123",
            role: "SHED",
        });
    expect(missingShed.status).toBe(400);
    expect(missingShed.body.error.code).toBe("VALIDATION_ERROR");

    const extraShed = await request(app)
        .post("/api/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
            name: "Gate With Shed",
            username: "gate-with-shed",
            password: "Secret@123",
            role: "GATE",
            shedId: shed.id,
        });
    expect(extraShed.status).toBe(400);
    expect(extraShed.body.error.code).toBe("VALIDATION_ERROR");

    const stored = await prisma.user.findUnique({
        where: { username: "no-shed" },
    });
    expect(stored).toBeNull();
});

test("disabled user cannot log in and is rejected by the middleware", async () => {
    const shed = await makeShed();
    const keeper = await makeUser("SHED", shed.id, "keeper");

    const patch = await request(app)
        .patch(`/api/users/${keeper.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: false });
    expect(patch.status).toBe(200);
    expect(patch.body.data.isActive).toBe(false);

    const disabledAudit = await prisma.auditEvent.findMany({
        where: { action: "USER_DISABLED", entityId: String(keeper.id) },
    });
    expect(disabledAudit).toHaveLength(1);

    const login = await request(app).post("/api/auth/login").send({
        username: "keeper",
        password: "Test@123",
    });
    expect(login.status).toBe(401);
    expect(login.body.error.code).toBe("INVALID_CREDENTIALS");

    const token = signToken({
        userId: keeper.id,
        role: "SHED",
        shedCode: shed.code,
    });
    const me = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(403);
    expect(me.body.error.code).toBe("ACCOUNT_DISABLED");

    const reEnabled = await request(app)
        .patch(`/api/users/${keeper.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: true });
    expect(reEnabled.status).toBe(200);
    expect(reEnabled.body.data.isActive).toBe(true);

    const enabledAudit = await prisma.auditEvent.findMany({
        where: { action: "USER_ENABLED", entityId: String(keeper.id) },
    });
    expect(enabledAudit).toHaveLength(1);

    const restored = await request(app).post("/api/auth/login").send({
        username: "keeper",
        password: "Test@123",
    });
    expect(restored.status).toBe(200);
});

test("reset password changes the login", async () => {
    const gate = await makeUser("GATE", null, "gate-user");

    const before = await request(app).post("/api/auth/login").send({
        username: "gate-user",
        password: "Test@123",
    });
    expect(before.status).toBe(200);

    const reset = await request(app)
        .post(`/api/users/${gate.id}/reset-password`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ password: "NewPass@123" });
    expect(reset.status).toBe(200);
    expect(reset.body.data).not.toHaveProperty("passwordHash");

    const stale = await request(app).post("/api/auth/login").send({
        username: "gate-user",
        password: "Test@123",
    });
    expect(stale.status).toBe(401);

    const changed = await request(app).post("/api/auth/login").send({
        username: "gate-user",
        password: "NewPass@123",
    });
    expect(changed.status).toBe(200);
    expect(typeof changed.body.data.token).toBe("string");

    const audits = await prisma.auditEvent.findMany({
        where: { action: "USER_PASSWORD_RESET", entityId: String(gate.id) },
    });
    expect(audits).toHaveLength(1);
});

test("admin cannot disable their own account", async () => {
    const res = await request(app)
        .patch(`/api/users/${adminId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ isActive: false });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CANNOT_DISABLE_SELF");

    const admin = await prisma.user.findUniqueOrThrow({
        where: { id: adminId },
    });
    expect(admin.isActive).toBe(true);
});

test("role and shed stay consistent on update", async () => {
    const shed = await makeShed();
    const keeper = await makeUser("SHED", shed.id, "keeper");

    const toGate = await request(app)
        .patch(`/api/users/${keeper.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: "GATE" });
    expect(toGate.status).toBe(200);
    expect(toGate.body.data).toMatchObject({ role: "GATE", shedId: null });

    const gateWithShed = await request(app)
        .patch(`/api/users/${keeper.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ shedId: shed.id });
    expect(gateWithShed.status).toBe(400);

    const toShed = await request(app)
        .patch(`/api/users/${keeper.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ role: "SHED", shedId: shed.id });
    expect(toShed.status).toBe(200);
    expect(toShed.body.data).toMatchObject({ role: "SHED", shedId: shed.id });

    const audits = await prisma.auditEvent.findMany({
        where: { action: "USER_UPDATED", entityId: String(keeper.id) },
    });
    expect(audits).toHaveLength(2);
});

test("non-admin cannot reach user management", async () => {
    const gate = await makeUser("GATE");
    const gateToken = signToken({ userId: gate.id, role: "GATE" });

    const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${gateToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
});
