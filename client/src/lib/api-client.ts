import type { AuthResponse, LoginInput } from "@/types/api";

export type ApiError = Error & { code: string; status: number };

export function createApiError(
    code: string,
    message: string,
    status: number,
): ApiError {
    return Object.assign(new Error(message), { code, status });
}

export function isApiError(error: unknown): error is ApiError {
    return (
        error instanceof Error &&
        typeof (error as { code?: unknown }).code === "string"
    );
}

type TokenGetter = () => string | null;
type UnauthorizedHandler = () => void;

let getToken: TokenGetter = () => null;
let onUnauthorized: UnauthorizedHandler = () => {};

export function configureApiClient(config: {
    getToken: TokenGetter;
    onUnauthorized: UnauthorizedHandler;
}) {
    getToken = config.getToken;
    onUnauthorized = config.onUnauthorized;
}

function apiBase() {
    return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
}

export async function apiFetch<T>(
    path: string,
    init?: RequestInit,
): Promise<T> {
    const token = getToken();
    const res = await fetch(`${apiBase()}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...init?.headers,
        },
    });
    if (res.status === 401) {
        onUnauthorized();
        throw createApiError(
            "UNAUTHORIZED",
            "Session expired. Please log in again.",
            401,
        );
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) {
        throw createApiError(
            body?.error?.code ?? "REQUEST_FAILED",
            body?.error?.message ?? `Request failed (${res.status})`,
            res.status,
        );
    }
    return body?.data as T;
}

export function loginRequest(input: LoginInput): Promise<AuthResponse> {
    return apiFetch<AuthResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export async function healthCheck(): Promise<boolean> {
    try {
        const res = await fetch(`${apiBase()}/health`);
        if (!res.ok) return false;
        const body = await res.json().catch(() => null);
        return body?.data?.status === "ok";
    } catch {
        return false;
    }
}
