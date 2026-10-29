import type { Response } from "express";

export function ok<T>(res: Response, data: T, status = 200) {
    return res.status(status).json({ data });
}

export interface Pagination {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
}

export function okPaginated<T>(res: Response, data: T, pagination: Pagination) {
    return res.status(200).json({ data, pagination });
}

export function fail(
    res: Response,
    code: string,
    message: string,
    status: number,
) {
    return res.status(status).json({ error: { code, message } });
}
