import { apiFetch } from "@/lib/api-client";
import type {
    CreateUserInput,
    ManagedUser,
    UpdateUserInput,
} from "@/types/api";

export function listUsers(): Promise<ManagedUser[]> {
    return apiFetch<ManagedUser[]>("/api/users");
}

export function createUserRequest(
    input: CreateUserInput,
): Promise<ManagedUser> {
    return apiFetch<ManagedUser>("/api/users", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export function updateUserRequest(
    id: number,
    input: UpdateUserInput,
): Promise<ManagedUser> {
    return apiFetch<ManagedUser>(`/api/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
    });
}

export function resetPasswordRequest(
    id: number,
    password: string,
): Promise<ManagedUser> {
    return apiFetch<ManagedUser>(`/api/users/${id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password }),
    });
}
