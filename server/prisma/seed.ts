import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SHOULD_RESET = process.argv.includes("--reset");
const IS_PROD = process.env.NODE_ENV === "production";

function seedPassword(key: string, fallback: string): Promise<string> {
    const value = process.env[key];
    if (value) {
        return bcrypt.hash(value, 12);
    }
    if (IS_PROD) {
        throw new Error(`Refusing to seed in production: missing ${key}.`);
    }
    console.warn(`[seed] ${key} unset, using dev fallback password.`);
    return bcrypt.hash(fallback, 12);
}

async function reset() {
    await prisma.$transaction([
        prisma.stockLedger.deleteMany(),
        prisma.requirementLine.deleteMany(),
        prisma.auditEvent.deleteMany(),
        prisma.visit.deleteMany(),
        prisma.item.deleteMany(),
        prisma.user.deleteMany(),
        prisma.shed.deleteMany(),
    ]);
}

async function main() {
    if (SHOULD_RESET) {
        await reset();
    }

    const adminHash = await seedPassword(
        "SEED_ADMIN_PASSWORD",
        "Admin@123-dev-only",
    );
    const gateHash = await seedPassword(
        "SEED_GATE_PASSWORD",
        "Gate@123-dev-only",
    );
    const shedAHash = await seedPassword(
        "SEED_SHEDA_PASSWORD",
        "ShedA@123-dev-only",
    );
    const shedBHash = await seedPassword(
        "SEED_SHEDB_PASSWORD",
        "ShedB@123-dev-only",
    );

    const shedA = await prisma.shed.upsert({
        where: { code: "SHED-A" },
        update: {},
        create: { name: "Shed A", code: "SHED-A" },
    });
    const shedB = await prisma.shed.upsert({
        where: { code: "SHED-B" },
        update: {},
        create: { name: "Shed B", code: "SHED-B" },
    });

    const items = [
        {
            name: "Item A1",
            category: "Ammo",
            unit: "box",
            shedId: shedA.id,
            currentStock: 100,
            reorderLevel: 20,
        },
        {
            name: "Item A2",
            category: "Ammo",
            unit: "box",
            shedId: shedA.id,
            currentStock: 150,
            reorderLevel: 30,
        },
        {
            name: "Item A3",
            category: "Fuse",
            unit: "pcs",
            shedId: shedA.id,
            currentStock: 200,
            reorderLevel: 40,
        },
        {
            name: "Item A4",
            category: "Fuse",
            unit: "pcs",
            shedId: shedA.id,
            currentStock: 80,
            reorderLevel: 10,
        },
        {
            name: "Item A5",
            category: "Shell",
            unit: "box",
            shedId: shedA.id,
            currentStock: 60,
            reorderLevel: 15,
        },
        {
            name: "Item B1",
            category: "Ammo",
            unit: "box",
            shedId: shedB.id,
            currentStock: 120,
            reorderLevel: 25,
        },
        {
            name: "Item B2",
            category: "Fuse",
            unit: "pcs",
            shedId: shedB.id,
            currentStock: 90,
            reorderLevel: 20,
        },
        {
            name: "Item B3",
            category: "Shell",
            unit: "box",
            shedId: shedB.id,
            currentStock: 70,
            reorderLevel: 10,
        },
        {
            name: "Item B4",
            category: "Charge",
            unit: "kg",
            shedId: shedB.id,
            currentStock: 50,
            reorderLevel: 10,
        },
        {
            name: "Item B5",
            category: "Charge",
            unit: "kg",
            shedId: shedB.id,
            currentStock: 40,
            reorderLevel: 5,
        },
    ];

    const admin = await prisma.user.upsert({
        where: { username: "admin" },
        update: {},
        create: {
            name: "Admin",
            username: "admin",
            passwordHash: adminHash,
            role: "ADMIN",
        },
    });

    for (const item of items) {
        const existing = await prisma.item.findFirst({
            where: { shedId: item.shedId, name: item.name },
        });
        if (existing) {
            continue;
        }
        const created = await prisma.item.create({ data: item });
        await prisma.stockLedger.create({
            data: {
                itemId: created.id,
                actorUserId: admin.id,
                type: "OPENING",
                delta: item.currentStock,
                balanceAfter: item.currentStock,
                reason: "Opening stock",
            },
        });
    }

    await prisma.user.upsert({
        where: { username: "gate" },
        update: {},
        create: {
            name: "Gate Clerk",
            username: "gate",
            passwordHash: gateHash,
            role: "GATE",
        },
    });
    await prisma.user.upsert({
        where: { username: "sheda" },
        update: {},
        create: {
            name: "Shed A Keeper",
            username: "sheda",
            passwordHash: shedAHash,
            role: "SHED",
            shedId: shedA.id,
        },
    });
    await prisma.user.upsert({
        where: { username: "shedb" },
        update: {},
        create: {
            name: "Shed B Keeper",
            username: "shedb",
            passwordHash: shedBHash,
            role: "SHED",
            shedId: shedB.id,
        },
    });

    console.log("Seed complete: 2 sheds, 10 items, 4 users");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => {
        void prisma.$disconnect();
    });
