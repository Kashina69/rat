import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/errors.js";

export function errorHandler(
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
) {
    if (err instanceof ApiError) {
        res.status(err.status).json({
            error: { code: err.code, message: err.message },
        });
        return;
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === "P2002") {
            res.status(409).json({
                error: {
                    code: "DUPLICATE",
                    message: "Duplicate record",
                },
            });
            return;
        }
        if (err.code === "P2025") {
            res.status(404).json({
                error: { code: "NOT_FOUND", message: "Record not found" },
            });
            return;
        }
    }
    console.error(err);
    if (res.headersSent) {
        return;
    }
    res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Internal Server Error" },
    });
}

export function notFound(_req: Request, res: Response) {
    res.status(404).json({
        error: { code: "NOT_FOUND", message: "Not Found" },
    });
}
