export function parseIdParam(value: unknown): number | null {
    const id = typeof value === "string" ? Number(value) : Number.NaN;
    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }
    return id;
}
