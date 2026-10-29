import type { LogFilters } from "@/types/api";

export const queryKeys = {
    all: ["dms"],
    visits: (status = "all") => [...queryKeys.all, "visits", status] as const,
    shedQueue: (code: string) =>
        [...queryKeys.all, "shed-queue", code] as const,
    items: (shed = "all") => [...queryKeys.all, "items", shed] as const,
    dashboard: () => [...queryKeys.all, "dashboard"] as const,
    logs: (filters: LogFilters = {}) =>
        [...queryKeys.all, "logs", filters] as const,
};
