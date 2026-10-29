"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { getShedQueue } from "@/services/sheds";

export function useShedQueue(code: string | null, enabled = true) {
    return useQuery({
        queryKey: queryKeys.shedQueue(code ?? ""),
        queryFn: () => getShedQueue(code as string),
        enabled: Boolean(code) && enabled,
    });
}
