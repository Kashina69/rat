const istFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
});

const IST_OFFSET_MS = 330 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAY_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function istMidnightUtc(day: string): Date | null {
    if (!DAY_ONLY_PATTERN.test(day)) {
        return null;
    }
    const [year, month, date] = day.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, date) - IST_OFFSET_MS);
}

export function istDayStartUtc(day: string): Date {
    return istMidnightUtc(day) ?? new Date(day);
}

export function istDayEndUtc(day: string): Date {
    const start = istMidnightUtc(day);
    if (!start) {
        return new Date(day);
    }
    return new Date(start.getTime() + MS_PER_DAY - 1);
}

export function formatIST(value: Date | string | null | undefined): string {
    if (!value) {
        return "";
    }
    const parts = new Map(
        istFormatter
            .formatToParts(new Date(value))
            .map((part) => [part.type, part.value]),
    );
    let hour = parts.get("hour") ?? "00";
    if (hour === "24") {
        hour = "00";
    }
    return `${parts.get("year")}-${parts.get("month")}-${parts.get("day")} ${hour}:${parts.get("minute")}:${parts.get("second")}`;
}
