"use client";

import { useMemo, useState } from "react";
import {
    EmptyState,
    ErrorState,
    LoadingState,
} from "@/components/common/States";
import { LineBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
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

    if (!shedCode) {
        return (
            <EmptyState
                title="No shed assigned"
                hint="Your user is not linked to a shed."
            />
        );
    }
    if (queueQuery.isPending)
        return <LoadingState label="Loading incoming queue…" />;
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
            <EmptyState
                title="Queue is clear"
                hint="New vehicle requirements will appear here instantly."
            />
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">
                    Incoming · {shedCode} ({queueQuery.data?.lines.length ?? 0})
                </h2>
                {connection !== "connected" && (
                    <span className="text-sm text-muted">
                        Stale
                        {lastSyncAt
                            ? ` · synced ${new Date(lastSyncAt).toLocaleTimeString()}`
                            : ""}
                    </span>
                )}
            </div>
            {grouped.map(({ vehicle, lines }) => (
                <article
                    key={vehicle.id}
                    className="flex flex-col gap-2 rounded-xl border border-line bg-surface-raised p-4"
                >
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-bold">
                            {vehicle.vehicleNumber}
                        </span>
                        <span className="text-sm text-muted">
                            {vehicle.driverName} · {vehicle.party} · arrived{" "}
                            {new Date(vehicle.arrivalAt).toLocaleString()}
                        </span>
                    </div>
                    <ul className="flex flex-col gap-2">
                        {lines.map((line) => (
                            <li
                                key={line.id}
                                className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2 text-base"
                            >
                                <LineBadge display="PENDING" />
                                <span className="font-semibold">
                                    {line.item.name}
                                </span>
                                <span className="text-muted">
                                    need {line.requestedQty} {line.item.unit} ·
                                    stock {line.item.currentStock}
                                </span>
                                <Button
                                    type="button"
                                    size="sm"
                                    className="ml-auto"
                                    onClick={() => setSelected(line)}
                                >
                                    Confirm
                                </Button>
                            </li>
                        ))}
                    </ul>
                </article>
            ))}
            <ConfirmDialog
                line={selected}
                open={selected !== null}
                onClose={() => setSelected(null)}
            />
        </div>
    );
}
