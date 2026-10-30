import type { Prisma } from "@prisma/client";
import ExcelJS from "exceljs";
import { db } from "../../config/db.js";
import { toCsv } from "../../utils/csv.js";
import {
    formatIST,
    istDayEndUtc,
    istDayStartUtc,
} from "../../utils/datetime.js";
import type {
    ExportLogsQuery,
    ListLogsQuery,
} from "../../validators/log.schemas.js";
import { lineDisplay, lineShortfall } from "../visits/visits.dto.js";

type LogFilterInput = Omit<ListLogsQuery, "page" | "limit">;

function buildLineWhere(
    filters: LogFilterInput,
): Prisma.RequirementLineWhereInput {
    const where: Prisma.RequirementLineWhereInput = {};
    if (filters.item !== undefined) {
        where.itemId = filters.item;
    }
    if (filters.status !== undefined) {
        where.status = filters.status;
    }
    if (filters.shed !== undefined) {
        where.shed = { code: filters.shed };
    }
    const visit: Prisma.VisitWhereInput = {};
    if (filters.vehicle !== undefined) {
        visit.vehicleNumber = { contains: filters.vehicle };
    }
    if (filters.from !== undefined || filters.to !== undefined) {
        visit.arrivalAt = {
            ...(filters.from !== undefined
                ? { gte: istDayStartUtc(filters.from) }
                : {}),
            ...(filters.to !== undefined
                ? { lte: istDayEndUtc(filters.to) }
                : {}),
        };
    }
    if (Object.keys(visit).length > 0) {
        where.visit = visit;
    }
    return where;
}

const lineWithRelations = {
    item: { include: { shed: true } },
    shed: true,
    confirmedByUser: {
        select: { id: true, name: true, username: true },
    },
    visit: {
        include: {
            gateUser: {
                select: { id: true, name: true, username: true },
            },
            checkoutByUser: {
                select: { id: true, name: true, username: true },
            },
        },
    },
} satisfies Prisma.RequirementLineInclude;

type LogRow = Prisma.RequirementLineGetPayload<{
    include: typeof lineWithRelations;
}>;

function toLogDto(line: LogRow) {
    return {
        lineId: line.id,
        vehicle: line.visit.vehicleNumber,
        driver: line.visit.driverName,
        party: line.visit.party,
        arrival: line.visit.arrivalAt,
        arrivalIST: formatIST(line.visit.arrivalAt),
        checkout: line.visit.checkoutAt,
        checkoutIST: formatIST(line.visit.checkoutAt),
        visitStatus: line.visit.status,
        shed: line.shed.code,
        shedName: line.shed.name,
        item: {
            id: line.item.id,
            name: line.item.name,
            category: line.item.category,
            unit: line.item.unit,
        },
        requested: line.requestedQty,
        loaded: line.loadedQty,
        shortfall: lineShortfall(
            line.status,
            line.requestedQty,
            line.loadedQty,
        ),
        lineStatus: line.status,
        display: lineDisplay(line.status, line.requestedQty, line.loadedQty),
        gateUser: line.visit.gateUser,
        confirmedBy: line.confirmedByUser,
        confirmedAt: line.confirmedAt,
        confirmedAtIST: formatIST(line.confirmedAt),
    };
}

type LogDto = ReturnType<typeof toLogDto>;

export async function listLogs(query: ListLogsQuery) {
    const where = buildLineWhere(query);
    const [totalItems, lines] = await db.$transaction([
        db.requirementLine.count({ where }),
        db.requirementLine.findMany({
            where,
            include: lineWithRelations,
            orderBy: [{ visit: { arrivalAt: "desc" } }, { id: "asc" }],
            skip: (query.page - 1) * query.limit,
            take: query.limit,
        }),
    ]);
    const totalPages = Math.max(1, Math.ceil(totalItems / query.limit));
    return {
        rows: lines.map(toLogDto),
        pagination: {
            page: query.page,
            limit: query.limit,
            totalItems,
            totalPages,
        },
    };
}

type ExportCell = string | number | null;

interface ExportColumn {
    header: string;
    width: number;
    value: (row: LogDto) => ExportCell;
}

const exportColumns: ExportColumn[] = [
    { header: "Vehicle", width: 16, value: (row) => row.vehicle },
    { header: "Driver", width: 18, value: (row) => row.driver },
    { header: "Party", width: 20, value: (row) => row.party },
    { header: "Arrival (IST)", width: 20, value: (row) => row.arrivalIST },
    { header: "Checkout (IST)", width: 20, value: (row) => row.checkoutIST },
    { header: "Visit Status", width: 18, value: (row) => row.visitStatus },
    { header: "Shed", width: 10, value: (row) => row.shed },
    { header: "Item", width: 24, value: (row) => row.item.name },
    { header: "Category", width: 16, value: (row) => row.item.category },
    { header: "Unit", width: 10, value: (row) => row.item.unit },
    { header: "Requested", width: 12, value: (row) => row.requested },
    { header: "Loaded", width: 10, value: (row) => row.loaded },
    { header: "Shortfall", width: 12, value: (row) => row.shortfall },
    { header: "Line Status", width: 14, value: (row) => row.lineStatus },
    { header: "Display", width: 12, value: (row) => row.display },
    { header: "Gate User", width: 16, value: (row) => row.gateUser.username },
    {
        header: "Confirmed By",
        width: 16,
        value: (row) => row.confirmedBy?.username ?? null,
    },
    {
        header: "Confirmed At (IST)",
        width: 20,
        value: (row) => row.confirmedAtIST,
    },
];

const exportHeaders = exportColumns.map((column) => column.header);

function toSheetValue(value: ExportCell): ExportCell {
    return value === "" ? null : value;
}

async function loadExportRows(filters: ExportLogsQuery): Promise<LogDto[]> {
    const lines = await db.requirementLine.findMany({
        where: buildLineWhere(filters),
        include: lineWithRelations,
        orderBy: [{ visit: { arrivalAt: "desc" } }, { id: "asc" }],
    });
    return lines.map(toLogDto);
}

export async function exportLogsCsv(filters: ExportLogsQuery) {
    const rows = await loadExportRows(filters);
    const csv = toCsv(
        exportHeaders,
        rows.map((row) => exportColumns.map((column) => column.value(row))),
    );
    return { csv, count: rows.length };
}

export async function exportLogsXlsx(filters: ExportLogsQuery) {
    const rows = await loadExportRows(filters);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Logs");
    sheet.columns = exportColumns.map((column) => ({
        header: column.header,
        width: column.width,
    }));
    for (const row of rows) {
        sheet.addRow(
            exportColumns.map((column) => toSheetValue(column.value(row))),
        );
    }
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    const buffer = await workbook.xlsx.writeBuffer();
    return { buffer: Buffer.from(buffer), count: rows.length };
}
