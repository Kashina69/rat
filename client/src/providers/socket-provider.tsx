"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
    createContext,
    type ReactNode,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import {
    type AppSocket,
    createSocket,
    SESSION_EXPIRED_EVENT,
    SOCKET_EVENTS,
} from "@/lib/socket-client";
import { useAuth } from "./auth-provider";

export type ConnectionState = "connected" | "connecting" | "disconnected";

interface SocketState {
    socket: AppSocket | null;
    connection: ConnectionState;
    lastSyncAt: number | null;
}

const SocketContext = createContext<SocketState>({
    socket: null,
    connection: "disconnected",
    lastSyncAt: null,
});

export function SocketProvider({ children }: { children: ReactNode }) {
    const { token, logout } = useAuth();
    const queryClient = useQueryClient();
    const [socket, setSocket] = useState<AppSocket | null>(null);
    const [connection, setConnection] =
        useState<ConnectionState>("disconnected");
    const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

    useEffect(() => {
        if (!token) {
            setSocket((prev) => {
                prev?.disconnect();
                return null;
            });
            setConnection("disconnected");
            return;
        }
        setConnection("connecting");
        const instance = createSocket(token);
        setSocket(instance);

        const refetchAll = () => {
            void queryClient.invalidateQueries({ queryKey: queryKeys.all });
            setLastSyncAt(Date.now());
        };

        let ended = false;
        const endSession = () => {
            if (ended) {
                return;
            }
            ended = true;
            instance.removeAllListeners();
            instance.disconnect();
            setConnection("disconnected");
            logout();
            toast.error("Session expired. Sign in again.");
        };

        instance.on("connect", () => {
            setConnection("connected");
            refetchAll();
        });
        instance.on("reconnect", refetchAll);
        instance.on("disconnect", () => setConnection("disconnected"));
        instance.on(SESSION_EXPIRED_EVENT, endSession);
        instance.on("connect_error", (error: Error) => {
            if (error.message === "UNAUTHORIZED") {
                endSession();
                return;
            }
            setConnection("disconnected");
        });
        for (const event of SOCKET_EVENTS) {
            instance.on(event, () => {
                void queryClient.invalidateQueries({
                    queryKey: queryKeys.all,
                });
                setLastSyncAt(Date.now());
            });
        }
        return () => {
            instance.removeAllListeners();
            instance.disconnect();
            setSocket(null);
        };
    }, [token, logout, queryClient]);

    const value = useMemo(
        () => ({ socket, connection, lastSyncAt }),
        [socket, connection, lastSyncAt],
    );
    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocket() {
    return useContext(SocketContext);
}

export function useConnection() {
    return useContext(SocketContext).connection;
}
