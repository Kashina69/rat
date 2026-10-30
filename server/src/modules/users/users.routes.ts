import { Router } from "express";
import { auth } from "../../middlewares/auth.js";
import { requireRole } from "../../middlewares/requireRole.js";
import { validate } from "../../middlewares/validate.js";
import {
    createUserSchema,
    resetPasswordSchema,
    updateUserSchema,
} from "../../validators/users.schemas.js";
import * as usersController from "./users.controller.js";

export const usersRoutes = Router();

usersRoutes.use(auth, requireRole("ADMIN"));

usersRoutes.get("/", usersController.listUsers);

usersRoutes.post("/", validate(createUserSchema), usersController.createUser);

usersRoutes.patch(
    "/:id",
    validate(updateUserSchema),
    usersController.updateUser,
);

usersRoutes.post(
    "/:id/reset-password",
    validate(resetPasswordSchema),
    usersController.resetPassword,
);
