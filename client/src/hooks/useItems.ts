"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
    adjustStockRequest,
    archiveItemRequest,
    createItemRequest,
    listItems,
    listSheds,
    type NewItemInput,
    stockInRequest,
    updateItemRequest,
} from "@/services/items";
import type { InventoryItem } from "@/types/api";
import type {
    AdjustStockFormInput,
    StockInFormInput,
    UpdateItemFormInput,
} from "@/validations/item";

export function useItems(shed?: string, enabled = true) {
    return useQuery({
        queryKey: queryKeys.items(shed ?? "all"),
        queryFn: () => listItems(shed),
        enabled,
    });
}

export function useSheds(enabled = true) {
    return useQuery({
        queryKey: [...queryKeys.all, "sheds"],
        queryFn: listSheds,
        enabled,
    });
}

function invalidateItemQueries(queryClient: ReturnType<typeof useQueryClient>) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.all });
}

export function useCreateItem() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: NewItemInput) => createItemRequest(input),
        onSuccess: () => invalidateItemQueries(queryClient),
    });
}

export function useUpdateItem() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            input,
        }: {
            id: number;
            input: UpdateItemFormInput;
        }) => updateItemRequest(id, input),
        onSuccess: () => invalidateItemQueries(queryClient),
    });
}

export function useArchiveItem() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => archiveItemRequest(id),
        onSuccess: (_res, id) => {
            queryClient.setQueryData<InventoryItem[]>(
                queryKeys.items("all"),
                (old) =>
                    old
                        ? old.map((item) =>
                              item.id === id
                                  ? { ...item, isActive: false }
                                  : item,
                          )
                        : old,
            );
            invalidateItemQueries(queryClient);
        },
    });
}

export function useStockIn() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, input }: { id: number; input: StockInFormInput }) =>
            stockInRequest(id, input),
        onSuccess: () => invalidateItemQueries(queryClient),
    });
}

export function useAdjustStock() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            input,
        }: {
            id: number;
            input: AdjustStockFormInput;
        }) => adjustStockRequest(id, input),
        onSuccess: () => invalidateItemQueries(queryClient),
    });
}
