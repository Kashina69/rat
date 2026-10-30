import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/errors.js";
import { fail } from "../utils/responses.js";

type ErrorMapping = {
    code: string;
    message: string;
    status: number;
};

const bodyParserErrors = new Map<string, ErrorMapping>([
    [
        "entity.too.large",
        {
            code: "REQUEST_TOO_LARGE",
            message: "Request body too large",
            status: 413,
        },
    ],
    [
        "entity.parse.failed",
        {
            code: "INVALID_JSON",
            message: "Invalid JSON body",
            status: 400,
        },
    ],
]);

function bodyParserError(err: unknown): ErrorMapping | undefined {
    if (!(err instanceof Error)) {
        return undefined;
    }
    const type = (err as { type?: unknown }).type;
    if (typeof type !== "string") {
        return undefined;
    }
    return bodyParserErrors.get(type);
}

function isCorsRejection(err: unknown): boolean {
    return err instanceof Error && err.message.startsWith("Origin not allowed");
}

function prismaError(err: unknown): ErrorMapping | undefined {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError)) {
        return undefined;
    }
    if (err.code === "P2002") {
        return { code: "DUPLICATE", message: "Duplicate record", status: 409 };
    }
    if (err.code === "P2025") {
        return { code: "NOT_FOUND", message: "Record not found", status: 404 };
    }
    if (err.code === "P2003") {
        return {
            code: "CONFLICT",
            message: "Related record conflict",
            status: 409,
        };
    }
    return undefined;
}

export function errorHandler(
    err: unknown,
    _req: Request,
    res: Response,
    next: NextFunction,
) {
    if (res.headersSent) {
        next(err);
        return;
    }
    if (err instanceof ApiError) {
        fail(res, err.code, err.message, err.status);
        return;
    }
    if (isCorsRejection(err)) {
        fail(res, "FORBIDDEN_ORIGIN", "Origin not allowed", 403);
        return;
    }
    const bodyError = bodyParserError(err);
    if (bodyError) {
        fail(res, bodyError.code, bodyError.message, bodyError.status);
        return;
    }
    const dbError = prismaError(err);
    if (dbError) {
        fail(res, dbError.code, dbError.message, dbError.status);
        return;
    }
    console.error(err);
    fail(res, "INTERNAL_ERROR", "Internal Server Error", 500);
}

export function notFound(_req: Request, res: Response) {
    res.status(404).json({
        error: { code: "NOT_FOUND", message: "Not Found" },
    });
}
