import { Router } from "express";
import { auth } from "../../middlewares/auth.js";
import { requireRole } from "../../middlewares/requireRole.js";
import * as shedsController from "./sheds.controller.js";

export const shedsRoutes = Router();

shedsRoutes.get(
    "/",
    auth,
    requireRole("ADMIN", "GATE", "SHED"),
    shedsController.listSheds,
);

shedsRoutes.get(
    "/:code/queue",
    auth,
    requireRole("SHED", "ADMIN"),
    shedsController.getShedQueue,
);
