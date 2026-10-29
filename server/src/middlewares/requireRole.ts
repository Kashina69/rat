import type { Role } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { fail } from "../utils/responses.js";

export function requireRole(...roles: Role[]) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return fail(res, "UNAUTHORIZED", "Invalid credentials", 401);
        }
        if (!roles.includes(req.user.role)) {
            return fail(res, "FORBIDDEN", "Insufficient permissions", 403);
        }
        return next();
    };
}
