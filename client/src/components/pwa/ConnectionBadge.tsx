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
              : "default";
    const label =
        state === "online"
            ? "Live"
            : state === "degraded"
              ? "Syncing"
              : "Offline";
    const dot =
        state === "online"
            ? "bg-brand-600"
            : state === "degraded"
              ? "bg-amber-500"
              : "bg-muted-foreground";

    const syncTime = mounted ? (lastSyncAt ?? lastCheckedAt) : null;
    const syncLabel = syncTime
        ? ` · synced ${new Date(syncTime).toLocaleTimeString()}`
        : "";

    return (
        <Badge
            variant={variant}
            aria-live="polite"
            title={syncLabel || label}
            className="tabular-nums"
        >
            <span
                aria-hidden
                className={`inline-block size-2 rounded-full ${dot}`}
            />
            {label}
            {state !== "online" && syncTime
                ? ` · ${new Date(syncTime).toLocaleTimeString()}`
                : ""}
        </Badge>
    );
}
