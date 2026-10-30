import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { fail, ok } from "../../utils/responses.js";
import { getDashboard } from "./dashboard.service.js";

export const getDashboardHandler = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) {
            return fail(res, "UNAUTHORIZED", "Invalid credentials", 401);
        }
        const dashboard = await getDashboard(req.user);
        return ok(res, dashboard);
    },
);
