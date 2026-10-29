import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { fail, ok } from "../../utils/responses.js";
import * as authService from "./auth.service.js";

export const login = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body);
    if (!result) {
        return fail(res, "INVALID_CREDENTIALS", "Invalid credentials", 401);
    }
    return ok(res, result);
});

export const me = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
        return fail(res, "UNAUTHORIZED", "Invalid credentials", 401);
    }
    const user = await authService.getMe(req.user.id);
    if (!user) {
        return fail(res, "UNAUTHORIZED", "Invalid credentials", 401);
    }
    return ok(res, user);
});
