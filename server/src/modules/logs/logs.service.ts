import type { Prisma } from "@prisma/client";
import { db } from "../../config/db.js";
import { toCsv } from "../../utils/csv.js";
import { formatIST } from "../../utils/datetime.js";
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
                ? { gte: new Date(filters.from) }
                : {}),
            ...(filters.to !== undefined ? { lte: new Date(filters.to) } : {}),
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

const exportHeaders = [
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

export async function exportLogsCsv(filters: ExportLogsQuery) {
    const lines = await db.requirementLine.findMany({
        where: buildLineWhere(filters),
        include: lineWithRelations,
        orderBy: [{ visit: { arrivalAt: "desc" } }, { id: "asc" }],
    });
    const dtos = lines.map(toLogDto);
    const csv = toCsv(
        exportHeaders,
        dtos.map((row) => [
            row.vehicle,
            row.driver,
            row.party,
            row.arrivalIST,
            row.checkoutIST,
            row.visitStatus,
            row.shed,
            row.item.name,
            row.item.category,
            row.item.unit,
            row.requested,
            row.loaded ?? "",
            row.shortfall ?? "",
            row.lineStatus,
            row.display,
            row.gateUser.username,
            row.confirmedBy?.username ?? "",
            row.confirmedAtIST,
        ]),
    );
    return { csv, count: dtos.length };
}
