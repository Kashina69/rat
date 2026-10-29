import { apiFetch, apiFetchBlob, apiFetchPaginated } from "@/lib/api-client";
import type {
    DashboardData,
    LogFilters,
    LogRow,
    Pagination,
} from "@/types/api";

export function fetchDashboard(): Promise<DashboardData> {
    return apiFetch<DashboardData>("/api/dashboard");
}

export function fetchLogs(
    filters: LogFilters,
): Promise<{ rows: LogRow[]; pagination: Pagination }> {
    const params = new URLSearchParams();
    if (filters.vehicle) params.set("vehicle", filters.vehicle);
    if (filters.item !== undefined) params.set("item", String(filters.item));
    if (filters.shed) params.set("shed", filters.shed);
    if (filters.status) params.set("status", filters.status);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    params.set("page", String(filters.page ?? 1));
    params.set("limit", String(filters.limit ?? 50));
    return apiFetchPaginated<LogRow[]>(`/api/logs?${params.toString()}`).then(
        (r) => ({ rows: r.data, pagination: r.pagination }),
    );
}

export function exportLogsBlob(
    filters: Omit<LogFilters, "page" | "limit">,
): Promise<Blob> {
    const params = new URLSearchParams();
    if (filters.vehicle) params.set("vehicle", filters.vehicle);
    if (filters.item !== undefined) params.set("item", String(filters.item));
    if (filters.shed) params.set("shed", filters.shed);
    if (filters.status) params.set("status", filters.status);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    const qs = params.toString();
    return apiFetchBlob(`/api/logs/export${qs ? `?${qs}` : ""}`);
}
