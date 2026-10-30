import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { confirmLine } from "../src/modules/visits/visits.service.js";
import {
    makeItem,
    makeShed,
    makeUser,
    makeVisitWithLines,
} from "./factories.js";
import { migrateTestDb, prisma, truncateAll } from "./setup.js";

beforeAll(async () => {
    await migrateTestDb();
}, 120_000);

afterAll(async () => {
    await prisma.$disconnect();
});

beforeEach(async () => {
    await truncateAll();
});

test("duplicate requirementLineId makes confirm fail with P2002 and rolls back stock + line", async () => {
    const shed = await makeShed();
    const shedUser = await makeUser("SHED", shed.id);
    const gate = await makeUser("GATE");
    const item = await makeItem(shed.id, { currentStock: 50 });
    const visit = await makeVisitWithLines(gate.id, [
        { itemId: item.id, shedId: shed.id, qty: 10 },
    ]);
    const lineId = visit.requirementLines[0].id;

    await prisma.stockLedger.create({
        data: {
            itemId: item.id,
            requirementLineId: lineId,
            actorUserId: shedUser.id,
            type: "OUT",
            delta: -1,
            balanceAfter: 49,
            reason: "poisoned ledger row",
        },
    });

    const failure = await confirmLine(lineId, 10, {
        id: shedUser.id,
        role: "SHED",
        shedId: shed.id,
        shedCode: shed.code,
    }).then(
        () => null,
        (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    const prismaFailure = failure as Prisma.PrismaClientKnownRequestError;
    expect(prismaFailure.code).toBe("P2002");
    const detail =
        `${prismaFailure.message} ${JSON.stringify(prismaFailure.meta ?? {})}`.toLowerCase();
    expect(
        detail.includes("requirementlineid") ||
            detail.includes("requirement_line_id"),
    ).toBe(true);

    const unchangedItem = await prisma.item.findUniqueOrThrow({
        where: { id: item.id },
    });
    expect(unchangedItem.currentStock).toBe(50);

    const unchangedLine = await prisma.requirementLine.findUniqueOrThrow({
        where: { id: lineId },
    });
    expect(unchangedLine.status).toBe("PENDING");
    expect(unchangedLine.loadedQty).toBeNull();
    expect(unchangedLine.confirmedByUserId).toBeNull();
    expect(unchangedLine.confirmedAt).toBeNull();

    const unchangedVisit = await prisma.visit.findUniqueOrThrow({
        where: { id: visit.id },
    });
    expect(unchangedVisit.status).toBe("AWAITING_LOADING");

    const ledgerRows = await prisma.stockLedger.findMany({
        where: { itemId: item.id },
        orderBy: { id: "asc" },
    });
    expect(ledgerRows.map((row) => row.type)).toEqual(["OPENING", "OUT"]);
    expect(ledgerRows.map((row) => row.delta)).toEqual([50, -1]);
    expect(
        await prisma.stockLedger.count({
            where: { requirementLineId: lineId },
        }),
    ).toBe(1);

    const confirmAudits = await prisma.auditEvent.findMany({
        where: { action: "LINE_CONFIRMED", entityId: String(lineId) },
    });
    expect(confirmAudits).toHaveLength(0);
});
