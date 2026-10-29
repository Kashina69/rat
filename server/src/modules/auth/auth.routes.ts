import { Router } from "express";
import { auth } from "../../middlewares/auth.js";
import { rateLimit } from "../../middlewares/rateLimit.js";
import { validate } from "../../middlewares/validate.js";
import { loginSchema } from "../../validators/auth.schemas.js";
import * as authController from "./auth.controller.js";

export const authRoutes = Router();

authRoutes.post(
    "/login",
    rateLimit,
    validate(loginSchema),
    authController.login,
);
authRoutes.get("/me", auth, authController.me);
