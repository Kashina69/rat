"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
    createUserRequest,
    listUsers,
    resetPasswordRequest,
    updateUserRequest,
} from "@/services/users";
import type { CreateUserInput, UpdateUserInput } from "@/types/api";

export function useUsers() {
    return useQuery({
        queryKey: queryKeys.users(),
        queryFn: listUsers,
    });
}

export function useCreateUser() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateUserInput) => createUserRequest(input),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.users() });
        },
    });
}

export function useUpdateUser() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, input }: { id: number; input: UpdateUserInput }) =>
            updateUserRequest(id, input),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.users() });
        },
    });
}

export function useResetUserPassword() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, password }: { id: number; password: string }) =>
            resetPasswordRequest(id, password),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.users() });
        },
    });
}
