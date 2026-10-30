"use client";

import {
    EmptyState,
    ErrorState,
    LoadingState,
} from "@/components/common/States";
import { Badge } from "@/components/ui/badge";
import { useItems } from "@/hooks/useItems";
import { useSocket } from "@/providers/socket-provider";

export function ShedStock({ shedCode }: { shedCode: string | null }) {
    const itemsQuery = useItems(shedCode ?? undefined, Boolean(shedCode));
    const { connection, lastSyncAt } = useSocket();
    const stale = connection !== "connected";

    if (!shedCode) {
        return (
            <EmptyState
                title="No shed assigned"
                hint="Your account is not linked to a shed yet."
            />
        );
    }
    if (itemsQuery.isPending)
        return <LoadingState label="Loading shed stock…" />;
    if (itemsQuery.isError) {
        return (
            <ErrorState
                message="Could not load shed stock."
                onRetry={() => void itemsQuery.refetch()}
            />
        );
    }

    const items = itemsQuery.data ?? [];
    if (items.length === 0) {
        return (
            <EmptyState
                title="No items in this shed"
                hint="Items appear here once an admin adds them."
            />
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Stock · {shedCode}</h2>
                {stale && (
                    <span className="text-sm text-muted">
                        Stale
                        {lastSyncAt
                            ? ` · synced ${new Date(lastSyncAt).toLocaleTimeString()}`
                            : ""}
                    </span>
                )}
            </div>
            <ul className="flex flex-col gap-2">
                {items.map((item) => (
                    <li
                        key={item.id}
                        className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-raised px-3 py-2 text-base"
                    >
                        <span className="font-semibold">{item.name}</span>
                        <span className="text-muted">
                            {item.category} · {item.currentStock} {item.unit}
                        </span>
                        {item.currentStock <= item.reorderLevel ? (
                            <Badge variant="warning">Low stock</Badge>
                        ) : (
                            <Badge variant="success">
                                {item.currentStock} {item.unit}
                            </Badge>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
