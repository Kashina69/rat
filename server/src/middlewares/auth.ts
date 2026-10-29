import type { NextFunction, Request, Response } from "express";
import { db } from "../config/db.js";
import { verifyToken } from "../utils/jwt.js";
import { fail } from "../utils/responses.js";

export async function auth(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        return fail(res, "UNAUTHORIZED", "Missing or invalid token", 401);
    }
    const token = header.slice("Bearer ".length);
    try {
        const payload = verifyToken(token);
        const user = await db.user.findUnique({
            where: { id: payload.userId },
            include: { shed: true },
        });
        if (!user) {
            return fail(res, "UNAUTHORIZED", "Invalid credentials", 401);
        }
        req.user = {
            id: user.id,
            role: user.role,
            shedId: user.shedId,
            shedCode: user.shed?.code ?? null,
        };
        return next();
    } catch {
        return fail(res, "UNAUTHORIZED", "Invalid credentials", 401);
    }
}
