import { apiFetchBlob } from "@/lib/api-client";
import type { LogFilters } from "@/types/api";

type ExportFilters = Omit<LogFilters, "page" | "limit">;

function exportSearchParams(filters: ExportFilters): string {
    const params = new URLSearchParams();
    if (filters.vehicle) params.set("vehicle", filters.vehicle);
    if (filters.item !== undefined) params.set("item", String(filters.item));
    if (filters.shed) params.set("shed", filters.shed);
    if (filters.status) params.set("status", filters.status);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    return params.toString();
}

function saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadLogsXlsx(filters: ExportFilters): Promise<void> {
    const query = exportSearchParams(filters);
    const blob = await apiFetchBlob(
        `/api/logs/export.xlsx${query ? `?${query}` : ""}`,
    );
    saveBlob(blob, "logs.xlsx");
}
