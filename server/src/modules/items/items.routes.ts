import { Router } from "express";
import { auth } from "../../middlewares/auth.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { validate, validateQuery } from "../../middlewares/validate.js";
import {
    adjustStockSchema,
    createItemSchema,
    listItemsQuerySchema,
    stockInSchema,
    updateItemSchema,
} from "../../validators/item.schemas.js";
import * as itemsController from "./items.controller.js";

export const itemsRoutes = Router();

itemsRoutes.get(
    "/",
    auth,
    requireRole("ADMIN", "GATE", "SHED"),
    validateQuery(listItemsQuerySchema),
    itemsController.listItems,
);

itemsRoutes.post(
    "/",
    auth,
    requireRole("ADMIN"),
    validate(createItemSchema),
    itemsController.createItem,
);

itemsRoutes.put(
    "/:id",
    auth,
    requireRole("ADMIN"),
    validate(updateItemSchema),
    itemsController.updateItem,
);

itemsRoutes.delete(
    "/:id",
    auth,
    requireRole("ADMIN"),
    itemsController.deleteItem,
);

itemsRoutes.post(
    "/:id/stock-in",
    auth,
    requireRole("ADMIN"),
    validate(stockInSchema),
    itemsController.stockIn,
);

itemsRoutes.post(
    "/:id/adjust",
    auth,
    requireRole("ADMIN"),
    validate(adjustStockSchema),
    itemsController.adjustStock,
);
