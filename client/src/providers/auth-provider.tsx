"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { configureApiClient, loginRequest, meRequest } from "@/lib/api-client";
import type { AuthUser, LoginInput, Role } from "@/types/api";

const STORAGE_KEY_TOKEN = "rat_token";
const STORAGE_KEY_USER = "rat_user";

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

if (typeof window !== "undefined") {
    try {
        currentToken = localStorage.getItem(STORAGE_KEY_TOKEN);
    } catch {
        currentToken = null;
    }
}

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
    const queryClient = useQueryClient();
    const [user, setUser] = useState<AuthUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [initializing, setInitializing] = useState(true);

    const logout = useCallback(() => {
        currentToken = null;
        try {
            localStorage.removeItem(STORAGE_KEY_TOKEN);
            localStorage.removeItem(STORAGE_KEY_USER);
        } catch {
            // Ignore storage errors
        }
        setToken(null);
        setUser(null);
        queryClient.clear();
    }, [queryClient]);

    useEffect(() => {
        onAuthExpired(logout);
    }, [logout]);

    useEffect(() => {
        try {
            const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN);
            const savedUser = localStorage.getItem(STORAGE_KEY_USER);
            if (savedToken && savedUser) {
                const parsedUser = JSON.parse(savedUser) as AuthUser;
                currentToken = savedToken;
                setToken(savedToken);
                setUser(parsedUser);

                meRequest()
                    .then((freshUser) => {
                        setUser(freshUser);
                        try {
                            localStorage.setItem(
                                STORAGE_KEY_USER,
                                JSON.stringify(freshUser),
                            );
                        } catch {
                            // Ignore storage errors
                        }
                    })
                    .catch(() => {
                        // If token expired, 401 triggers onAuthExpired -> logout
                    });
            }
        } catch {
            try {
                localStorage.removeItem(STORAGE_KEY_TOKEN);
                localStorage.removeItem(STORAGE_KEY_USER);
            } catch {
                // Ignore storage errors
            }
        } finally {
            setInitializing(false);
        }
    }, []);

    const login = useCallback(async (input: LoginInput) => {
        const result = await loginRequest(input);
        currentToken = result.token;
        try {
            localStorage.setItem(STORAGE_KEY_TOKEN, result.token);
            localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(result.user));
        } catch {
            // Ignore storage errors
        }
        setToken(result.token);
        setUser(result.user);
        return result.user;
    }, []);

    const value = useMemo<AuthState>(
        () => ({
            user,
            token,
            initializing,
            isAuthenticated: user !== null && token !== null,
            role: user?.role ?? null,
            login,
            logout,
        }),
        [user, token, initializing, login, logout],
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
