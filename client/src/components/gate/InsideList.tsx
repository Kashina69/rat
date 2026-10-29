"use client";

import {
    EmptyState,
    ErrorState,
    LoadingState,
} from "@/components/common/States";
import { LineBadge, StatusBadge } from "@/components/common/StatusBadge";
import { useVisits } from "@/hooks/useVisits";
import { useSocket } from "@/providers/socket-provider";
import { CancelVisitButton, CheckoutButton } from "./CheckoutButton";

export function InsideList() {
    const visitsQuery = useVisits();
    const { connection, lastSyncAt } = useSocket();
    const stale = connection !== "connected";

    if (visitsQuery.isPending) return <LoadingState label="Loading visits…" />;
    if (visitsQuery.isError) {
        return (
            <ErrorState
                message="Could not load inside vehicles."
                onRetry={() => void visitsQuery.refetch()}
            />
        );
    }

    const visits = visitsQuery.data ?? [];
    if (visits.length === 0) {
        return (
            <EmptyState
                title="No vehicles inside"
                hint="Registered vehicles will appear here."
            />
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Inside ({visits.length})</h2>
                {stale && (
                    <span className="text-sm text-muted">
                        Stale
                        {lastSyncAt
                            ? ` · synced ${new Date(lastSyncAt).toLocaleTimeString()}`
                            : ""}
                    </span>
                )}
            </div>
            {visits.map((visit) => (
                <article
                    key={visit.id}
                    className="flex flex-col gap-3 rounded-xl border border-line bg-surface-raised p-4"
                >
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-bold">
                            {visit.vehicleNumber}
                        </span>
                        <StatusBadge status={visit.status} />
                        <span className="text-sm text-muted">
                            {visit.driverName} · {visit.party} ·{" "}
                            {new Date(visit.arrivalAt).toLocaleString()}
                        </span>
                    </div>
                    <ul className="flex flex-col gap-2">
                        {visit.lines.map((line) => (
                            <li
                                key={line.id}
                                className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2 text-base"
                            >
                                <LineBadge display={line.display} />
                                <span className="font-semibold">
                                    {line.item.name}
                                </span>
                                <span className="text-muted">
                                    {line.shed.code} · req {line.requestedQty}
                                    {line.loadedQty !== null
                                        ? ` · loaded ${line.loadedQty}`
                                        : ""}
                                    {line.shortfall !== null &&
                                    line.shortfall > 0
                                        ? ` · shortfall ${line.shortfall}`
                                        : ""}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <div className="flex flex-wrap gap-2">
                        <CheckoutButton visit={visit} />
                        <CancelVisitButton visit={visit} />
                    </div>
                </article>
            ))}
        </div>
    );
}
