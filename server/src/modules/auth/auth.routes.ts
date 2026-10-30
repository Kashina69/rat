import { Router } from "express";
import { auth } from "../../middlewares/auth.js";
import { loginLimiter } from "../../middlewares/limiters.js";
import { validate } from "../../middlewares/validate.js";
import { loginSchema } from "../../validators/auth.schemas.js";
import * as authController from "./auth.controller.js";

export const authRoutes = Router();

authRoutes.post(
    "/login",
    loginLimiter,
    validate(loginSchema),
    authController.login,
);
authRoutes.get("/me", auth, authController.me);
