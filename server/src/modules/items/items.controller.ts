import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { parseIdParam } from "../../utils/params.js";
import { fail, ok } from "../../utils/responses.js";
import type {
    AdjustStockInput,
    CreateItemInput,
    ListItemsQuery,
    StockInInput,
    UpdateItemInput,
} from "../../validators/item.schemas.js";
import * as itemsService from "./items.service.js";

export const listItems = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
        return fail(res, "UNAUTHORIZED", "Invalid credentials", 401);
    }
    const query = (req.validatedQuery ?? {}) as ListItemsQuery;
    const items = await itemsService.listItems(query, req.user);
    return ok(res, items);
});

export const createItem = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
        return fail(res, "UNAUTHORIZED", "Invalid credentials", 401);
    }
    const item = await itemsService.createItem(
        req.body as CreateItemInput,
        userId,
    );
    return ok(res, item, 201);
});

export const updateItem = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
        return fail(res, "UNAUTHORIZED", "Invalid credentials", 401);
    }
    const itemId = parseIdParam(req.params.id);
    if (!itemId) {
        return fail(res, "INVALID_ID", "Invalid item id", 400);
    }
    const item = await itemsService.updateItem(
        itemId,
        req.body as UpdateItemInput,
        userId,
    );
    return ok(res, item);
});

export const deleteItem = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
        return fail(res, "UNAUTHORIZED", "Invalid credentials", 401);
    }
    const itemId = parseIdParam(req.params.id);
    if (!itemId) {
        return fail(res, "INVALID_ID", "Invalid item id", 400);
    }
    const result = await itemsService.deleteItem(itemId, userId);
    return ok(res, result);
});

export const stockIn = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
        return fail(res, "UNAUTHORIZED", "Invalid credentials", 401);
    }
    const itemId = parseIdParam(req.params.id);
    if (!itemId) {
        return fail(res, "INVALID_ID", "Invalid item id", 400);
    }
    const item = await itemsService.stockIn(
        itemId,
        req.body as StockInInput,
        userId,
    );
    return ok(res, item);
});

export const adjustStock = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
        return fail(res, "UNAUTHORIZED", "Invalid credentials", 401);
    }
    const itemId = parseIdParam(req.params.id);
    if (!itemId) {
        return fail(res, "INVALID_ID", "Invalid item id", 400);
    }
    const item = await itemsService.adjustStock(
        itemId,
        req.body as AdjustStockInput,
        userId,
    );
    return ok(res, item);
});
