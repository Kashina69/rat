import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { parseIdParam } from "../../utils/params.js";
import { fail, ok } from "../../utils/responses.js";
import type {
    CreateUserInput,
    ResetPasswordInput,
    UpdateUserInput,
} from "../../validators/users.schemas.js";
import * as usersService from "./users.service.js";

export const listUsers = asyncHandler(async (_req: Request, res: Response) => {
    const users = await usersService.listUsers();
    return ok(res, users);
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
    const actorId = req.user?.id;
    if (!actorId) {
        return fail(res, "UNAUTHORIZED", "Invalid credentials", 401);
    }
    const user = await usersService.createUser(
        req.body as CreateUserInput,
        actorId,
    );
    return ok(res, user, 201);
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
    const actorId = req.user?.id;
    if (!actorId) {
        return fail(res, "UNAUTHORIZED", "Invalid credentials", 401);
    }
    const userId = parseIdParam(req.params.id);
    if (!userId) {
        return fail(res, "INVALID_ID", "Invalid user id", 400);
    }
    const user = await usersService.updateUser(
        userId,
        req.body as UpdateUserInput,
        actorId,
    );
    return ok(res, user);
});

export const resetPassword = asyncHandler(
    async (req: Request, res: Response) => {
        const actorId = req.user?.id;
        if (!actorId) {
            return fail(res, "UNAUTHORIZED", "Invalid credentials", 401);
        }
        const userId = parseIdParam(req.params.id);
        if (!userId) {
            return fail(res, "INVALID_ID", "Invalid user id", 400);
        }
        const user = await usersService.resetPassword(
            userId,
            req.body as ResetPasswordInput,
            actorId,
        );
        return ok(res, user);
    },
);
