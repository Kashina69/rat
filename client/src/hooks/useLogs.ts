"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { exportLogsBlob, fetchLogs } from "@/services/logs";
import type { LogFilters } from "@/types/api";

export function useLogs(filters: LogFilters, enabled = true) {
    return useQuery({
        queryKey: queryKeys.logs(filters),
        queryFn: () => fetchLogs(filters),
        placeholderData: keepPreviousData,
        enabled,
    });
}

export async function downloadLogsCsv(
    filters: Omit<LogFilters, "page" | "limit">,
): Promise<void> {
    const blob = await exportLogsBlob(filters);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "logs.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
