import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL ?? "";

if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set (tests/setup-env.ts loads it).");
}

export const prisma = new PrismaClient();

export async function migrateTestDb() {
    execSync("npx prisma migrate deploy", {
        env: { ...process.env },
        stdio: "pipe",
    });
}

export async function truncateAll() {
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

export async function ledgerSum(itemId: number): Promise<number> {
    const rows = await prisma.stockLedger.findMany({
        where: { itemId },
        select: { delta: true },
    });
    return rows.reduce((total, row) => total + row.delta, 0);
}

export async function assertLedgerInvariant(itemIds: number[]) {
    for (const itemId of itemIds) {
        const item = await prisma.item.findUniqueOrThrow({
            where: { id: itemId },
        });
        const sum = await ledgerSum(itemId);
        if (sum !== item.currentStock) {
            throw new Error(
                `Ledger invariant broken for item ${itemId}: SUM(delta)=${sum} != currentStock=${item.currentStock}`,
            );
        }
    }
}
