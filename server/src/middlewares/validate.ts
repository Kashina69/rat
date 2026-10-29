import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { fail } from "../utils/responses.js";

export function validate(schema: ZodType) {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return fail(
                res,
                "VALIDATION_ERROR",
                result.error.issues[0]?.message ?? "Invalid input",
                400,
            );
        }
        req.body = result.data;
        return next();
    };
}
