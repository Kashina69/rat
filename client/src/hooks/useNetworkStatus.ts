"use client";

import { useCallback, useEffect, useState } from "react";
import { healthCheck } from "@/lib/api-client";
import { useSocket } from "@/providers/socket-provider";

export type NetworkState = "online" | "degraded" | "offline";

function snapshot(
    browserOnline: boolean,
    socketConnected: boolean,
    apiReachable: boolean | null,
): NetworkState {
    if (!browserOnline) return "offline";
    if (socketConnected && (apiReachable === null || apiReachable)) {
        return "online";
    }
    if (!socketConnected && apiReachable === false) return "offline";
    return "degraded";
}

export function useNetworkStatus(pollMs = 15_000) {
    const { connection } = useSocket();
    // Assume online on first render so SSR and hydration match exactly.
    // The real browser state syncs in the effect below, right after mount.
    const [browserOnline, setBrowserOnline] = useState(true);
    const [apiReachable, setApiReachable] = useState<boolean | null>(null);
    const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);

    const check = useCallback(async () => {
        const ok = await healthCheck();
        setApiReachable(ok);
        setLastCheckedAt(Date.now());
    }, []);

    useEffect(() => {
        setBrowserOnline(navigator.onLine);
        const onOnline = () => {
            setBrowserOnline(true);
            void check();
        };
        const onOffline = () => setBrowserOnline(false);
        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);
        return () => {
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
        };
    }, [check]);

    useEffect(() => {
        void check();
        const timer = window.setInterval(check, pollMs);
        return () => window.clearInterval(timer);
    }, [check, pollMs]);

    const socketConnected = connection === "connected";
    return {
        state: snapshot(browserOnline, socketConnected, apiReachable),
        browserOnline,
        socketConnected,
        apiReachable,
        lastCheckedAt,
        recheck: check,
    };
}
