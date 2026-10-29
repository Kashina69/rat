import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/responses.js";
import { getDashboard } from "./dashboard.service.js";

export const getDashboardHandler = asyncHandler(
    async (_req: Request, res: Response) => {
        const dashboard = await getDashboard();
        return ok(res, dashboard);
    },
);
