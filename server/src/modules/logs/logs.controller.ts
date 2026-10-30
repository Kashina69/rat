import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { okPaginated } from "../../utils/responses.js";
import type {
    ExportLogsQuery,
    ListLogsQuery,
} from "../../validators/log.schemas.js";
import * as logsService from "./logs.service.js";

export const listLogs = asyncHandler(async (req: Request, res: Response) => {
    const query = req.validatedQuery as ListLogsQuery;
    const result = await logsService.listLogs(query);
    return okPaginated(res, result.rows, result.pagination);
});

export const exportLogs = asyncHandler(async (req: Request, res: Response) => {
    const query = req.validatedQuery as ExportLogsQuery;
    const { csv } = await logsService.exportLogsCsv(query);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="logs.csv"');
    return res.status(200).send(`\uFEFF${csv}`);
});

export const exportLogsXlsx = asyncHandler(
    async (req: Request, res: Response) => {
        const query = req.validatedQuery as ExportLogsQuery;
        const { buffer } = await logsService.exportLogsXlsx(query);
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        res.setHeader(
            "Content-Disposition",
            'attachment; filename="logs.xlsx"',
        );
        return res.status(200).send(buffer);
    },
);
