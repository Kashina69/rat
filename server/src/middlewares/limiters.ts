import { ipKeyGenerator, rateLimit } from "express-rate-limit";

export const loginLimiter = rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => {
        const username =
            typeof req.body?.username === "string" ? req.body.username : "";
        return `${ipKeyGenerator(req.ip ?? "")}:${username}`;
    },
    message: {
        error: {
            code: "RATE_LIMITED",
            message: "Too many attempts, try again later",
        },
    },
});

export const apiLimiter = rateLimit({
    windowMs: 60_000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        error: {
            code: "RATE_LIMITED",
            message: "Too many requests, try again later",
        },
    },
});
