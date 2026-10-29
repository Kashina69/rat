import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { fail, ok } from "../../utils/responses.js";
import * as shedsService from "./sheds.service.js";

export const listSheds = asyncHandler(async (_req: Request, res: Response) => {
    const sheds = await shedsService.listSheds();
    return ok(res, sheds);
});

export const getShedQueue = asyncHandler(
    async (req: Request, res: Response) => {
        if (!req.user) {
            return fail(res, "UNAUTHORIZED", "Invalid credentials", 401);
        }
        const code = String(req.params.code ?? "").trim();
        if (!code) {
            return fail(res, "INVALID_CODE", "Invalid shed code", 400);
        }
        const queue = await shedsService.getShedQueue(code, req.user);
        return ok(res, queue);
    },
);
