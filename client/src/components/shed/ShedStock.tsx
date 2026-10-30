"use client";

import { Package } from "lucide-react";
import {
    EmptyState,
    ErrorState,
    LoadingState,
} from "@/components/common/States";
import { StaleLabel } from "@/components/common/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useItems } from "@/hooks/useItems";
import { useSocket } from "@/providers/socket-provider";

export function ShedStock({ shedCode }: { shedCode: string | null }) {
    const itemsQuery = useItems(shedCode ?? undefined, Boolean(shedCode));
    const { connection, lastSyncAt } = useSocket();
    const stale = connection !== "connected";

    if (!shedCode) {
        return (
            <EmptyState
                title="No shed selected"
                hint="Select a shed to view current inventory and stock levels."
            />
        );
    }
    if (itemsQuery.isPending) {
        return <LoadingState label="Loading shed stock…" />;
    }
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
            <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
                    <div className="flex items-center gap-2.5">
                        <h2 className="text-lg font-bold tracking-tight text-foreground">
                            Shed Stock
                        </h2>
                        <Badge variant="default" className="tabular-nums">
                            0 items
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        {stale ? (
                            <StaleLabel when={lastSyncAt} />
                        ) : (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-brand-700">
                                <span className="size-1.5 rounded-full bg-brand-500 animate-pulse" />
                                Live sync
                            </span>
                        )}
                    </div>
                </div>
                <EmptyState
                    title="No items in this shed"
                    hint="Items appear here once an inventory record is created for this shed."
                />
            </div>
        );
    }

    const lowStockCount = items.filter(
        (item) => item.currentStock <= item.reorderLevel,
    ).length;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
                <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-bold tracking-tight text-foreground">
                        Shed Stock
                    </h2>
                    <Badge variant="default" className="tabular-nums">
                        {items.length} {items.length === 1 ? "item" : "items"}
                    </Badge>
                    {lowStockCount > 0 && (
                        <Badge variant="warning" className="tabular-nums">
                            {lowStockCount} low
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {stale ? (
                        <StaleLabel when={lastSyncAt} />
                    ) : (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-brand-700">
                            <span className="size-1.5 rounded-full bg-brand-500 animate-pulse" />
                            Live sync
                        </span>
                    )}
                </div>
            </div>

            <Card className="border-border bg-card shadow-none overflow-hidden">
                <div className="divide-y divide-border">
                    {items.map((item) => {
                        const isLow = item.currentStock <= item.reorderLevel;
                        return (
                            <div
                                key={item.id}
                                className="flex items-center justify-between gap-3 p-3.5 sm:p-4 hover:bg-subtle/40 transition-colors"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="flex size-8 items-center justify-center rounded-[8px] bg-brand-50 text-brand-700 shrink-0">
                                        <Package className="size-4" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-sm font-semibold text-foreground truncate">
                                            {item.name}
                                        </span>
                                        <span className="text-xs text-muted-foreground truncate">
                                            {item.category} &middot; Reorder at{" "}
                                            <span className="tabular-nums">
                                                {item.reorderLevel}
                                            </span>{" "}
                                            {item.unit}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2.5 shrink-0">
                                    <span className="text-sm font-semibold tabular-nums text-foreground">
                                        {item.currentStock}{" "}
                                        <span className="text-xs font-normal text-muted-foreground">
                                            {item.unit}
                                        </span>
                                    </span>
                                    {isLow ? (
                                        <Badge variant="warning">
                                            Low stock
                                        </Badge>
                                    ) : (
                                        <Badge variant="success">Healthy</Badge>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </Card>
        </div>
    );
}
