import type { NextFunction, Request, Response } from "express";
import { db } from "../config/db.js";
import type { JwtPayload } from "../types/domain.js";
import { verifyToken } from "../utils/jwt.js";
import { fail } from "../utils/responses.js";

function findUser(userId: number) {
    return db.user.findUnique({
        where: { id: userId },
        include: { shed: true },
    });
}

export async function auth(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
        return fail(res, "UNAUTHORIZED", "Missing or invalid token", 401);
    }
    const token = header.slice("Bearer ".length).trim();
    if (token.length === 0) {
        return fail(res, "UNAUTHORIZED", "Missing or invalid token", 401);
    }

    let payload: JwtPayload;
    try {
        payload = verifyToken(token);
    } catch {
        return fail(res, "UNAUTHORIZED", "Invalid or expired token", 401);
    }
    if (typeof payload.userId !== "number") {
        return fail(res, "UNAUTHORIZED", "Invalid or expired token", 401);
    }

    let user: Awaited<ReturnType<typeof findUser>>;
    try {
        user = await findUser(payload.userId);
    } catch (error) {
        return next(error);
    }

    if (!user) {
        return fail(res, "UNAUTHORIZED", "Invalid credentials", 401);
    }

    if (!user.isActive) {
        return fail(res, "ACCOUNT_DISABLED", "This account is disabled", 403);
    }

    req.user = {
        id: user.id,
        role: user.role,
        shedId: user.shedId,
        shedCode: user.shed?.code ?? null,
    };
    return next();
}
