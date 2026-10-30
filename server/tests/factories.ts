import { randomUUID } from "node:crypto";
import type { Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "./setup.js";

function unique(prefix: string): string {
    return `${prefix}-${randomUUID().slice(0, 8)}`;
}

export async function makeShed(code?: string) {
    const shedCode = (code ?? unique("SHED")).slice(0, 20).toUpperCase();
    return prisma.shed.create({
        data: { name: shedCode, code: shedCode },
    });
}

export async function makeUser(
    role: Role,
    shedId: number | null = null,
    username?: string,
) {
    const name = username ?? unique("user");
    return prisma.user.create({
        data: {
            name,
            username: name,
            passwordHash: await bcrypt.hash("Test@123", 4),
            role,
            shedId,
        },
    });
}

export async function makeItem(
    shedId: number,
    overrides: Partial<Prisma.ItemCreateInput> = {},
    actorUserId?: number,
) {
    const adminId = actorUserId ?? (await makeUser("ADMIN")).id;
    const { ...data } = overrides;
    const item = await prisma.item.create({
        data: {
            name: unique("Item"),
            category: "Ammo",
            unit: "box",
            shed: { connect: { id: shedId } },
            currentStock: 100,
            reorderLevel: 10,
            ...data,
        },
    });
    await prisma.stockLedger.create({
        data: {
            itemId: item.id,
            actorUserId: adminId,
            type: "OPENING",
            delta: item.currentStock,
            balanceAfter: item.currentStock,
            reason: "Opening stock",
        },
    });
    return item;
}

export async function makeVisitWithLines(
    gateUserId: number,
    lines: Array<{ itemId: number; shedId: number; qty: number }>,
) {
    return prisma.visit.create({
        data: {
            vehicleNumber: unique("TN-01"),
            driverName: "Driver",
            party: "Party",
            status: "AWAITING_LOADING",
            gateUserId,
            requirementLines: {
                create: lines.map((line) => ({
                    itemId: line.itemId,
                    shedId: line.shedId,
                    requestedQty: line.qty,
                    status: "PENDING",
                })),
            },
        },
        include: { requirementLines: true },
    });
}
