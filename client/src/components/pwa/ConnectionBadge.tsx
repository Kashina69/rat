"use client";

import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useSocket } from "@/providers/socket-provider";
import { Badge } from "../ui/badge";

export function ConnectionBadge() {
    const { state, lastCheckedAt } = useNetworkStatus();
    const { lastSyncAt } = useSocket();

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

    const syncTime = lastSyncAt ?? lastCheckedAt;
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
