"use client";

import { Clock, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import {
    EmptyState,
    ErrorState,
    LoadingState,
} from "@/components/common/States";
import { LineBadge, StaleLabel } from "@/components/common/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useShedQueue } from "@/hooks/useShedQueue";
import { useSocket } from "@/providers/socket-provider";
import type { QueueLine } from "@/types/api";
import { ConfirmDialog } from "./ConfirmDialog";

export function IncomingQueue({ shedCode }: { shedCode: string | null }) {
    const queueQuery = useShedQueue(shedCode);
    const { connection, lastSyncAt } = useSocket();
    const [selected, setSelected] = useState<QueueLine | null>(null);

    const grouped = useMemo(() => {
        const map = new Map<
            number,
            { vehicle: QueueLine["visit"]; lines: QueueLine[] }
        >();
        for (const line of queueQuery.data?.lines ?? []) {
            const entry = map.get(line.visit.id);
            if (entry) entry.lines.push(line);
            else map.set(line.visit.id, { vehicle: line.visit, lines: [line] });
        }
        return [...map.values()];
    }, [queueQuery.data]);

    const totalLines = queueQuery.data?.lines.length ?? 0;

    if (!shedCode) {
        return (
            <EmptyState
                title="No shed selected"
                hint="Select a shed to view incoming vehicle requirements and pending queue."
            />
        );
    }
    if (queueQuery.isPending) {
        return <LoadingState label="Loading incoming queue…" />;
    }
    if (queueQuery.isError) {
        return (
            <ErrorState
                message="Could not load the incoming queue."
                onRetry={() => void queueQuery.refetch()}
            />
        );
    }
    if (grouped.length === 0) {
        return (
            <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
                    <div className="flex items-center gap-2.5">
                        <h2 className="text-lg font-bold tracking-tight text-foreground">
                            Incoming Queue
                        </h2>
                        <Badge variant="default" className="tabular-nums">
                            0 lines pending
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        {connection !== "connected" ? (
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
                    title="Queue is clear"
                    hint="No vehicles currently awaiting loading. New requirements will appear here instantly."
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
                <div className="flex items-center gap-2.5">
                    <h2 className="text-lg font-bold tracking-tight text-foreground">
                        Incoming Queue
                    </h2>
                    <Badge variant="info" className="tabular-nums">
                        {totalLines}{" "}
                        {totalLines === 1 ? "line pending" : "lines pending"}
                    </Badge>
                </div>
                <div className="flex items-center gap-2">
                    {connection !== "connected" ? (
                        <StaleLabel when={lastSyncAt} />
                    ) : (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-brand-700">
                            <span className="size-1.5 rounded-full bg-brand-500 animate-pulse" />
                            Live sync
                        </span>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-4">
                {grouped.map(({ vehicle, lines }) => (
                    <Card
                        key={vehicle.id}
                        className="border-border bg-card shadow-none transition-shadow hover:shadow-sm"
                    >
                        <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border bg-subtle/30">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="flex size-9 items-center justify-center rounded-[10px] bg-brand-50 text-brand-700 shrink-0">
                                        <Truck className="size-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-base font-bold tracking-tight text-foreground">
                                                {vehicle.vehicleNumber}
                                            </span>
                                            {vehicle.party && (
                                                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                    &middot; {vehicle.party}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate">
                                            Driver: {vehicle.driverName}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground self-start sm:self-center shrink-0">
                                    <Clock className="size-3.5 text-muted-foreground" />
                                    <span>
                                        Arrived{" "}
                                        {new Date(
                                            vehicle.arrivalAt,
                                        ).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </span>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-5 pt-3.5">
                            <div className="flex flex-col gap-2.5">
                                {lines.map((line) => (
                                    <div
                                        key={line.id}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[10px] border border-border bg-card p-3 sm:p-3.5 transition-colors hover:border-brand-200"
                                    >
                                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                                            <LineBadge
                                                display={
                                                    line.display ?? "PENDING"
                                                }
                                            />
                                            <div className="min-w-0">
                                                <p className="font-semibold text-sm text-foreground truncate">
                                                    {line.item.name}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    Requested:{" "}
                                                    <span className="font-semibold text-foreground tabular-nums">
                                                        {line.requestedQty}
                                                    </span>{" "}
                                                    {line.item.unit} &middot; In
                                                    stock:{" "}
                                                    <span className="font-semibold text-foreground tabular-nums">
                                                        {line.item.currentStock}
                                                    </span>{" "}
                                                    {line.item.unit}
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            size="sm"
                                            className="self-end sm:self-center shrink-0 min-w-[110px]"
                                            onClick={() => setSelected(line)}
                                        >
                                            Confirm Load
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <ConfirmDialog
                line={selected}
                open={selected !== null}
                onClose={() => setSelected(null)}
            />
        </div>
    );
}
