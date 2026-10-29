import type { NextFunction, Request, Response } from "express";

export function errorHandler(
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
) {
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
