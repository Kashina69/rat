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
