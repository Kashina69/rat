import ExcelJS from "exceljs";
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

const EXPECTED_HEADERS = [
    "Vehicle",
    "Driver",
    "Party",
    "Arrival (IST)",
    "Checkout (IST)",
    "Visit Status",
    "Shed",
    "Item",
    "Category",
    "Unit",
    "Requested",
    "Loaded",
    "Shortfall",
    "Line Status",
    "Display",
    "Gate User",
    "Confirmed By",
    "Confirmed At (IST)",
];

const XLSX_CONTENT_TYPE =
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

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

function xlsxRequest(token: string, query = "") {
    return request(app)
        .get(`/api/logs/export.xlsx${query}`)
        .set("Authorization", `Bearer ${token}`)
        .buffer(true)
        .parse((res, callback) => {
            const chunks: Buffer[] = [];
            res.on("data", (chunk: Buffer) => chunks.push(chunk));
            res.on("end", () => callback(null, Buffer.concat(chunks)));
        });
}

async function loadWorkbook(body: Buffer): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(body as unknown as ArrayBuffer);
    return workbook;
}

function headerValues(sheet: ExcelJS.Worksheet): unknown[] {
    return EXPECTED_HEADERS.map(
        (_, index) => sheet.getCell(1, index + 1).value,
    );
}

function rowValues(
    sheet: ExcelJS.Worksheet,
    rowNumber: number,
): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    for (const [index, header] of EXPECTED_HEADERS.entries()) {
        values[header] = sheet.getCell(rowNumber, index + 1).value;
    }
    return values;
}

function dataRowCount(sheet: ExcelJS.Worksheet): number {
    let count = 0;
    for (let row = 2; row <= sheet.rowCount; row += 1) {
        if (sheet.getCell(row, 1).value !== null) {
            count += 1;
        }
    }
    return count;
}

function firstCsvCell(line: string): string {
    const end = line.indexOf('",');
    const value = end === -1 ? line.slice(1, -1) : line.slice(1, end);
    return value.replace(/""/g, '"');
}

test("GET /api/logs/export.xlsx returns a formatted ADMIN workbook", async () => {
    const shed = await makeShed();
    const admin = await makeUser("ADMIN");
    const gate = await makeUser("GATE");
    const shedUser = await makeUser("SHED", shed.id);
    const item = await makeItem(shed.id, {
        name: "9mm rounds",
        category: "Ammo",
        unit: "box",
    });
    const visit = await makeVisitWithLines(
        gate.id,
        [{ itemId: item.id, shedId: shed.id, qty: 3 }],
        {
            arrivalAt: new Date("2026-10-30T04:30:00.000Z"),
            status: "PARTIALLY_LOADED",
        },
    );
    await prisma.requirementLine.update({
        where: { id: visit.requirementLines[0].id },
        data: {
            status: "LOADED",
            loadedQty: 2,
            confirmedByUserId: shedUser.id,
            confirmedAt: new Date("2026-10-30T05:00:00.000Z"),
        },
    });
    const token = signToken({ userId: admin.id, role: "ADMIN" });

    const res = await xlsxRequest(token);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe(XLSX_CONTENT_TYPE);
    expect(res.headers["content-disposition"]).toBe(
        'attachment; filename="logs.xlsx"',
    );

    const workbook = await loadWorkbook(res.body as Buffer);
    const sheet = workbook.getWorksheet("Logs");
    expect(sheet).toBeDefined();
    if (!sheet) {
        throw new Error("Logs worksheet is missing");
    }
    expect(sheet.views?.[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(headerValues(sheet)).toEqual(EXPECTED_HEADERS);

    expect(dataRowCount(sheet)).toBe(1);
    const row = rowValues(sheet, 2);
    expect(row.Vehicle).toBe(visit.vehicleNumber);
    expect(row.Driver).toBe("Driver");
    expect(row.Party).toBe("Party");
    expect(row["Arrival (IST)"]).toBe("2026-10-30 10:00:00");
    expect(row["Checkout (IST)"]).toBeNull();
    expect(row["Visit Status"]).toBe("PARTIALLY_LOADED");
    expect(row.Shed).toBe(shed.code);
    expect(row.Item).toBe("9mm rounds");
    expect(row.Category).toBe("Ammo");
    expect(row.Unit).toBe("box");
    expect(row.Requested).toBe(3);
    expect(row.Loaded).toBe(2);
    expect(row.Shortfall).toBe(1);
    expect(row["Line Status"]).toBe("LOADED");
    expect(row.Display).toBe("SHORT");
    expect(row["Gate User"]).toBe(gate.username);
    expect(row["Confirmed By"]).toBe(shedUser.username);
    expect(row["Confirmed At (IST)"]).toBe("2026-10-30 10:30:00");
});

test("rows keep the CSV order and formula-like values stay plain text", async () => {
    const shed = await makeShed();
    const admin = await makeUser("ADMIN");
    const gate = await makeUser("GATE");
    const laterItem = await makeItem(shed.id, { name: "Later item" });
    const earlierItem = await makeItem(shed.id, { name: "=1+1" });
    const later = await makeVisitWithLines(
        gate.id,
        [{ itemId: laterItem.id, shedId: shed.id, qty: 1 }],
        { arrivalAt: new Date("2026-10-30T04:30:00.000Z") },
    );
    await makeVisitWithLines(
        gate.id,
        [{ itemId: earlierItem.id, shedId: shed.id, qty: 7 }],
        { arrivalAt: new Date("2026-10-28T04:30:00.000Z") },
    );
    const token = signToken({ userId: admin.id, role: "ADMIN" });

    const res = await xlsxRequest(token);

    expect(res.status).toBe(200);
    const sheet = await loadWorkbook(res.body as Buffer).then((workbook) =>
        workbook.getWorksheet("Logs"),
    );
    if (!sheet) {
        throw new Error("Logs worksheet is missing");
    }
    expect(dataRowCount(sheet)).toBe(2);
    expect(sheet.getCell(2, 1).value).toBe(later.vehicleNumber);
    expect(sheet.getCell(2, EXPECTED_HEADERS.indexOf("Item") + 1).value).toBe(
        "Later item",
    );

    const formulaLike = sheet.getCell(3, EXPECTED_HEADERS.indexOf("Item") + 1);
    expect(formulaLike.value).toBe("=1+1");
    expect(typeof formulaLike.value).toBe("string");
    expect(formulaLike.type).toBe(ExcelJS.ValueType.String);
    expect(formulaLike.type).not.toBe(ExcelJS.ValueType.Formula);
    expect(formulaLike.formula).toBeUndefined();

    const requested = sheet.getCell(
        3,
        EXPECTED_HEADERS.indexOf("Requested") + 1,
    );
    expect(requested.value).toBe(7);
    expect(typeof requested.value).toBe("number");
});

test("the workbook applies the same filters and order as the CSV export", async () => {
    const shedA = await makeShed();
    const shedB = await makeShed();
    const admin = await makeUser("ADMIN");
    const gate = await makeUser("GATE");
    const itemA = await makeItem(shedA.id);
    const itemB = await makeItem(shedB.id);
    const pendingVisit = await makeVisitWithLines(
        gate.id,
        [{ itemId: itemA.id, shedId: shedA.id, qty: 2 }],
        { arrivalAt: new Date("2026-10-30T04:30:00.000Z") },
    );
    await makeVisitWithLines(
        gate.id,
        [{ itemId: itemB.id, shedId: shedB.id, qty: 5 }],
        { arrivalAt: new Date("2026-10-30T06:30:00.000Z") },
    );
    await makeVisitWithLines(
        gate.id,
        [{ itemId: itemA.id, shedId: shedA.id, qty: 9 }],
        { arrivalAt: new Date("2026-10-25T04:30:00.000Z") },
    );
    const token = signToken({ userId: admin.id, role: "ADMIN" });

    const newestFirst = await xlsxRequest(token, `?shed=${shedB.code}`);
    expect(newestFirst.status).toBe(200);

    const shedSheet = await loadWorkbook(newestFirst.body as Buffer).then(
        (workbook) => workbook.getWorksheet("Logs"),
    );
    if (!shedSheet) {
        throw new Error("Logs worksheet is missing");
    }
    expect(dataRowCount(shedSheet)).toBe(1);
    expect(rowValues(shedSheet, 2).Shed).toBe(shedB.code);

    const dayFiltered = await xlsxRequest(
        token,
        "?from=2026-10-30&to=2026-10-30",
    );
    const daySheet = await loadWorkbook(dayFiltered.body as Buffer).then(
        (workbook) => workbook.getWorksheet("Logs"),
    );
    if (!daySheet) {
        throw new Error("Logs worksheet is missing");
    }
    expect(dataRowCount(daySheet)).toBe(2);
    expect(rowValues(daySheet, 2).Vehicle).not.toBe(pendingVisit.vehicleNumber);
    expect(rowValues(daySheet, 3).Vehicle).toBe(pendingVisit.vehicleNumber);

    const csvRes = await request(app)
        .get("/api/logs/export?from=2026-10-30&to=2026-10-30")
        .set("Authorization", `Bearer ${token}`)
        .buffer(true)
        .parse((res, callback) => {
            const chunks: Buffer[] = [];
            res.on("data", (chunk: Buffer) => chunks.push(chunk));
            res.on("end", () => callback(null, Buffer.concat(chunks)));
        });
    expect(csvRes.status).toBe(200);
    const csvText = (csvRes.body as Buffer).toString("utf8");
    const csvLines = csvText
        .replace(/^\uFEFF/, "")
        .trimEnd()
        .split("\r\n");
    expect(csvLines).toHaveLength(3);
    expect(csvLines[0]).toContain('"Vehicle","Driver","Party"');
    const csvVehicles = csvLines.slice(1).map((line) => firstCsvCell(line));
    expect(csvVehicles).toEqual([
        rowValues(daySheet, 2).Vehicle,
        rowValues(daySheet, 3).Vehicle,
    ]);
    expect(csvVehicles[1]).toBe(pendingVisit.vehicleNumber);
});

test("the xlsx export is ADMIN only", async () => {
    const gate = await makeUser("GATE");
    const token = signToken({ userId: gate.id, role: "GATE" });

    const res = await xlsxRequest(token);

    expect(res.status).toBe(403);
});
