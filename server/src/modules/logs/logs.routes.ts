import { Router } from "express";
import { auth } from "../../middlewares/auth.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { validateQuery } from "../../middlewares/validate.js";
import {
    exportLogsQuerySchema,
    listLogsQuerySchema,
} from "../../validators/log.schemas.js";
import * as logsController from "./logs.controller.js";

export const logsRoutes = Router();

logsRoutes.get(
    "/",
    auth,
    requireRole("ADMIN"),
    validateQuery(listLogsQuerySchema),
    logsController.listLogs,
);

logsRoutes.get(
    "/export",
    auth,
    requireRole("ADMIN"),
    validateQuery(exportLogsQuerySchema),
    logsController.exportLogs,
);

logsRoutes.get(
    "/export.xlsx",
    auth,
    requireRole("ADMIN"),
    validateQuery(exportLogsQuerySchema),
    logsController.exportLogsXlsx,
);
