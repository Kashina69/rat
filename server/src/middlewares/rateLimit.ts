import type { NextFunction, Request, Response } from "express";
import { fail } from "../utils/responses.js";

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;

const attempts = new Map<string, number[]>();

export function rateLimit(req: Request, res: Response, next: NextFunction) {
    const username =
        typeof req.body?.username === "string" ? req.body.username : "";
    const key = `${req.ip}:${username}`;
    const now = Date.now();
    const history = (attempts.get(key) ?? []).filter(
        (t) => now - t < WINDOW_MS,
    );
    if (history.length >= MAX_ATTEMPTS) {
        return fail(
            res,
            "RATE_LIMITED",
            "Too many attempts, try again later",
            429,
        );
    }
    history.push(now);
    attempts.set(key, history);
    return next();
}
