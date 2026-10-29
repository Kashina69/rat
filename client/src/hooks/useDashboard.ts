"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { fetchDashboard } from "@/services/logs";

export function useDashboard(enabled = true) {
    return useQuery({
        queryKey: queryKeys.dashboard(),
        queryFn: fetchDashboard,
        enabled,
    });
}
