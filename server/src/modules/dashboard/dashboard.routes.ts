import { Router } from "express";
import { auth } from "../../middlewares/auth.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { getDashboardHandler } from "./dashboard.controller.js";

export const dashboardRoutes = Router();

dashboardRoutes.get(
    "/",
    auth,
    requireRole("ADMIN", "GATE", "SHED"),
    getDashboardHandler,
);
