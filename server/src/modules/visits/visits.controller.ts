import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { parseIdParam } from "../../utils/params.js";
import { fail, ok } from "../../utils/responses.js";
import type {
    ConfirmLineInput,
    CreateVisitInput,
} from "../../validators/visit.schemas.js";
import * as visitsService from "./visits.service.js";

function requireUserId(req: Request) {
    return req.user?.id ?? null;
}

export const createVisit = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    if (!userId) {
        return fail(res, "UNAUTHORIZED", "Invalid credentials", 401);
    }
    const result = await visitsService.createVisit(
        req.body as CreateVisitInput,
        userId,
    );
    return ok(res, result, 201);
});

export const listVisits = asyncHandler(async (_req: Request, res: Response) => {
    const visits = await visitsService.listInside();
    return ok(res, visits);
});

export const cancelVisit = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    if (!userId) {
        return fail(res, "UNAUTHORIZED", "Invalid credentials", 401);
    }
    const visitId = parseIdParam(req.params.id);
    if (!visitId) {
        return fail(res, "INVALID_ID", "Invalid visit id", 400);
    }
    const visit = await visitsService.cancelVisit(visitId, userId);
    return ok(res, visit);
});

export const cancelLine = asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    if (!userId) {
        return fail(res, "UNAUTHORIZED", "Invalid credentials", 401);
    }
    const lineId = parseIdParam(req.params.id);
    if (!lineId) {
        return fail(res, "INVALID_ID", "Invalid line id", 400);
    }
    const line = await visitsService.cancelLine(lineId, userId);
    return ok(res, line);
});

export const confirmLine = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
        return fail(res, "UNAUTHORIZED", "Invalid credentials", 401);
    }
    const lineId = parseIdParam(req.params.id);
    if (!lineId) {
        return fail(res, "INVALID_ID", "Invalid line id", 400);
    }
    const { loadedQty } = req.body as ConfirmLineInput;
    const line = await visitsService.confirmLine(lineId, loadedQty, req.user);
    return ok(res, line);
});

export const checkoutVisit = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = requireUserId(req);
        if (!userId) {
            return fail(res, "UNAUTHORIZED", "Invalid credentials", 401);
        }
        const visitId = parseIdParam(req.params.id);
        if (!visitId) {
            return fail(res, "INVALID_ID", "Invalid visit id", 400);
        }
        const visit = await visitsService.checkoutVisit(visitId, userId);
        return ok(res, visit);
    },
);
