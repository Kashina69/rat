"use client";

import { useEffect, useState } from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useSocket } from "@/providers/socket-provider";
import { Badge } from "../ui/badge";

export function ConnectionBadge() {
    const { state, lastCheckedAt } = useNetworkStatus();
    const { lastSyncAt } = useSocket();
    // Rendered only after mount: Date().toLocaleTimeString() differs by
    // machine/locale, so it must never appear in the SSR/hydration pass.
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const variant =
        state === "online"
            ? "success"
            : state === "degraded"
              ? "warning"
              : "destructive";
    const label =
        state === "online"
            ? "Live"
            : state === "degraded"
              ? "Degraded"
              : "Offline";

    const syncTime = mounted ? (lastSyncAt ?? lastCheckedAt) : null;
    const syncLabel = syncTime
        ? ` · synced ${new Date(syncTime).toLocaleTimeString()}`
        : "";

    return (
        <Badge variant={variant} aria-live="polite" title={syncLabel || label}>
            <span
                aria-hidden
                className={`mr-1.5 inline-block size-2.5 rounded-full ${
                    state === "online"
                        ? "bg-emerald-400"
                        : state === "degraded"
                          ? "bg-amber-400"
                          : "bg-red-400"
                }`}
            />
            {label}
            {state !== "online" && syncTime
                ? ` · ${new Date(syncTime).toLocaleTimeString()}`
                : ""}
        </Badge>
    );
}
