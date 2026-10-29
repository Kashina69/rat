import { Router } from "express";
import { auth } from "../../middlewares/auth.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { validate, validateQuery } from "../../middlewares/validate.js";
import {
    confirmLineSchema,
    createVisitSchema,
    listVisitsQuerySchema,
} from "../../validators/visit.schemas.js";
import * as visitsController from "./visits.controller.js";

export const visitsRoutes = Router();

visitsRoutes.post(
    "/",
    auth,
    requireRole("GATE", "ADMIN"),
    validate(createVisitSchema),
    visitsController.createVisit,
);

visitsRoutes.get(
    "/",
    auth,
    requireRole("GATE", "ADMIN"),
    validateQuery(listVisitsQuerySchema),
    visitsController.listVisits,
);

visitsRoutes.post(
    "/:id/cancel",
    auth,
    requireRole("GATE", "ADMIN"),
    visitsController.cancelVisit,
);

visitsRoutes.post(
    "/:id/checkout",
    auth,
    requireRole("GATE", "ADMIN"),
    visitsController.checkoutVisit,
);

export const requirementLinesRoutes = Router();

requirementLinesRoutes.post(
    "/:id/cancel",
    auth,
    requireRole("GATE", "ADMIN"),
    visitsController.cancelLine,
);

requirementLinesRoutes.post(
    "/:id/confirm",
    auth,
    requireRole("SHED", "ADMIN"),
    validate(confirmLineSchema),
    visitsController.confirmLine,
);
