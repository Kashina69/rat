"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
    cancelLineRequest,
    cancelVisitRequest,
    checkoutVisitRequest,
    confirmLineRequest,
    createVisitRequest,
    listInsideVisits,
} from "@/services/visits";
import type { CreateVisitInput, Visit } from "@/types/api";

export function useVisits(enabled = true) {
    return useQuery({
        queryKey: queryKeys.visits("inside"),
        queryFn: listInsideVisits,
        enabled,
    });
}

function invalidateVisitQueries(
    queryClient: ReturnType<typeof useQueryClient>,
) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.all });
}

export function useCreateVisit() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateVisitInput) => createVisitRequest(input),
        onSuccess: () => invalidateVisitQueries(queryClient),
    });
}

export function useCancelVisit() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => cancelVisitRequest(id),
        onSuccess: (visit: Visit) => {
            queryClient.setQueryData<Visit[]>(
                queryKeys.visits("inside"),
                (old) => (old ? old.filter((v) => v.id !== visit.id) : old),
            );
            invalidateVisitQueries(queryClient);
        },
    });
}

export function useCancelLine() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => cancelLineRequest(id),
        onSuccess: () => invalidateVisitQueries(queryClient),
    });
}

export function useCheckoutVisit() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => checkoutVisitRequest(id),
        onSuccess: (visit: Visit) => {
            queryClient.setQueryData<Visit[]>(
                queryKeys.visits("inside"),
                (old) => (old ? old.filter((v) => v.id !== visit.id) : old),
            );
            invalidateVisitQueries(queryClient);
        },
    });
}

export function useConfirmLine() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, loadedQty }: { id: number; loadedQty: number }) =>
            confirmLineRequest(id, loadedQty),
        onSuccess: () => invalidateVisitQueries(queryClient),
    });
}
