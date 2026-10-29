export function escapeCsvCell(value: unknown): string {
    let text = value === null || value === undefined ? "" : String(value);
    if (/^[=+\-@]/.test(text)) {
        text = `'${text}`;
    }
    return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
    const lines = [
        headers.map(escapeCsvCell).join(","),
        ...rows.map((row) => row.map(escapeCsvCell).join(",")),
    ];
    return `${lines.join("\r\n")}\r\n`;
}
