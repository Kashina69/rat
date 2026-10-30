const FORMULA_PREFIX = /^[=+\-@]/;
const LEADING_IGNORED = /^[\s\p{Cc}]+/u;

export function escapeCsvCell(value: unknown): string {
    const text = value === null || value === undefined ? "" : String(value);
    const neutralized = FORMULA_PREFIX.test(text.replace(LEADING_IGNORED, ""))
        ? `'${text}`
        : text;
    return `"${neutralized.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
    const lines = [
        headers.map(escapeCsvCell).join(","),
        ...rows.map((row) => row.map(escapeCsvCell).join(",")),
    ];
    return `${lines.join("\r\n")}\r\n`;
}
