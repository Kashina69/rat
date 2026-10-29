"use client";

import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { configureApiClient, loginRequest } from "@/lib/api-client";
import type { AuthUser, LoginInput, Role } from "@/types/api";

interface AuthState {
    user: AuthUser | null;
    token: string | null;
    initializing: boolean;
    isAuthenticated: boolean;
    role: Role | null;
    login: (input: LoginInput) => Promise<AuthUser>;
    logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

let currentToken: string | null = null;
let unauthorizedListener: (() => void) | null = null;

export function getAuthToken() {
    return currentToken;
}

export function onAuthExpired(listener: () => void) {
    unauthorizedListener = listener;
}

configureApiClient({
    getToken: () => currentToken,
    onUnauthorized: () => unauthorizedListener?.(),
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [token, setToken] = useState<string | null>(null);

    const logout = useCallback(() => {
        currentToken = null;
        setToken(null);
        setUser(null);
    }, []);

    useEffect(() => {
        onAuthExpired(logout);
    }, [logout]);

    const login = useCallback(async (input: LoginInput) => {
        const result = await loginRequest(input);
        currentToken = result.token;
        setToken(result.token);
        setUser(result.user);
        return result.user;
    }, []);

    const value = useMemo<AuthState>(
        () => ({
            user,
            token,
            initializing: false,
            isAuthenticated: user !== null && token !== null,
            role: user?.role ?? null,
            login,
            logout,
        }),
        [user, token, login, logout],
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}

export function useAuthToken() {
    return useContext(AuthContext)?.token ?? null;
}
