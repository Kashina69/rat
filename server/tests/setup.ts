import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_URL ?? "";

if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set (tests/setup-env.ts loads it).");
}

export const prisma = new PrismaClient();

const TEST_DATABASE_SUFFIX = "_test";

function databaseName(rawUrl: string): string | null {
    try {
        const { pathname } = new URL(rawUrl);
        const name = decodeURIComponent(pathname).replace(/^\/+/, "");
        return name.length > 0 ? name : null;
    } catch {
        return null;
    }
}

function assertTestDatabase(): string {
    const name = databaseName(databaseUrl);
    if (name?.endsWith(TEST_DATABASE_SUFFIX)) {
        return name;
    }
    const label = name ?? "<could not parse DATABASE_URL>";
    console.error(
        `REFUSING TO TRUNCATE: database "${label}" does not end with "${TEST_DATABASE_SUFFIX}". Tests only wipe throwaway *_test databases.`,
    );
    throw new Error(
        `Refusing to truncate database "${label}": its name must end with "${TEST_DATABASE_SUFFIX}". Set TEST_DATABASE_URL to a throwaway MySQL database such as mysql://rat:rat@localhost:3306/rat_test`,
    );
}

const globalForMigrations = globalThis as unknown as {
    ratTestMigrations?: { url: string; run: Promise<void> };
};

async function deployMigrations(): Promise<void> {
    execSync("npx prisma migrate deploy", {
        env: { ...process.env },
        stdio: "pipe",
    });
}

// One deploy per test run: the promise is shared through globalThis so reused
// workers skip the second `prisma migrate deploy`. `vitest run` never changes
// migrations mid-run, so a stale cache is not a concern.
export function migrateTestDb(): Promise<void> {
    const existing = globalForMigrations.ratTestMigrations;
    if (existing?.url === databaseUrl) {
        return existing.run;
    }
    const run = deployMigrations().catch((error: unknown) => {
        globalForMigrations.ratTestMigrations = undefined;
        throw error;
    });
    globalForMigrations.ratTestMigrations = { url: databaseUrl, run };
    return run;
}

// FK-safe order: ledger and lines reference items/visits/users, items and users
// reference sheds. Deleting a parent before its children would fail.
export async function truncateAll() {
    assertTestDatabase();
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

export async function assertLedgerInvariant(
    itemIds?: number[],
): Promise<{ checked: number }> {
    const items = await prisma.item.findMany({
        where: itemIds ? { id: { in: itemIds } } : {},
        select: { id: true, currentStock: true },
        orderBy: { id: "asc" },
    });
    const sums = await prisma.stockLedger.groupBy({
        by: ["itemId"],
        where: itemIds ? { itemId: { in: itemIds } } : {},
        _sum: { delta: true },
    });
    const ledgerTotals = new Map(
        sums.map((row) => [row.itemId, row._sum.delta ?? 0]),
    );
    const broken = items.filter(
        (item) => (ledgerTotals.get(item.id) ?? 0) !== item.currentStock,
    );
    if (broken.length > 0) {
        const details = broken
            .map(
                (item) =>
                    `item ${item.id}: SUM(delta)=${ledgerTotals.get(item.id) ?? 0} != currentStock=${item.currentStock}`,
            )
            .join("; ");
        throw new Error(
            `Ledger invariant broken for ${broken.length} of ${items.length} item(s): ${details}`,
        );
    }
    return { checked: items.length };
}
