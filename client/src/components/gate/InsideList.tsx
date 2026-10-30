"use client";

import {
    EmptyState,
    ErrorState,
    LoadingState,
} from "@/components/common/States";
import {
    LineBadge,
    StaleLabel,
    StatusBadge,
} from "@/components/common/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useVisits } from "@/hooks/useVisits";
import { useSocket } from "@/providers/socket-provider";
import { CancelVisitButton, CheckoutButton } from "./CheckoutButton";

export function InsideList() {
    const visitsQuery = useVisits();
    const { connection, lastSyncAt } = useSocket();
    const stale = connection !== "connected";

    if (visitsQuery.isPending) {
        return <LoadingState label="Loading vehicles inside…" />;
    }

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
                hint="Registered vehicles currently on site will appear here."
            />
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-bold tracking-tight text-foreground">
                        Inside depot
                    </h2>
                    <Badge
                        variant="default"
                        className="tabular-nums font-semibold"
                    >
                        {visits.length}
                    </Badge>
                </div>
                {stale && <StaleLabel when={lastSyncAt} />}
            </div>

            <div className="flex flex-col gap-4">
                {visits.map((visit) => (
                    <Card
                        key={visit.id}
                        className="overflow-hidden shadow-none"
                    >
                        <div className="flex flex-col gap-4 p-5">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2.5">
                                        <h3 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                                            {visit.vehicleNumber}
                                        </h3>
                                        <StatusBadge status={visit.status} />
                                    </div>
                                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                                        <span className="font-medium text-foreground">
                                            {visit.driverName}
                                        </span>
                                        <span
                                            aria-hidden
                                            className="text-border-strong"
                                        >
                                            ·
                                        </span>
                                        <span>{visit.party}</span>
                                        <span
                                            aria-hidden
                                            className="text-border-strong"
                                        >
                                            ·
                                        </span>
                                        <span className="tabular-nums">
                                            Arrived{" "}
                                            {new Date(
                                                visit.arrivalAt,
                                            ).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-semibold text-muted-foreground">
                                    Consignment items
                                </span>
                                <div className="overflow-hidden rounded-[10px] border border-border bg-subtle/30">
                                    <ul className="divide-y divide-border/60">
                                        {visit.lines.map((line) => (
                                            <li
                                                key={line.id}
                                                className="flex flex-col gap-2 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                                            >
                                                <div className="flex min-w-0 items-center gap-2.5">
                                                    <LineBadge
                                                        display={line.display}
                                                    />
                                                    <span className="truncate font-semibold text-foreground">
                                                        {line.item.name}
                                                    </span>
                                                    <span className="shrink-0 rounded-[6px] border border-border bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                                        Shed {line.shed.code}
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums text-muted-foreground sm:text-sm">
                                                    <span>
                                                        Req:{" "}
                                                        <strong className="font-semibold text-foreground">
                                                            {line.requestedQty}
                                                        </strong>
                                                    </span>
                                                    {line.loadedQty !==
                                                        null && (
                                                        <span>
                                                            Loaded:{" "}
                                                            <strong className="font-semibold text-foreground">
                                                                {line.loadedQty}
                                                            </strong>
                                                        </span>
                                                    )}
                                                    {line.shortfall !== null &&
                                                        line.shortfall > 0 && (
                                                            <span className="font-medium text-warning">
                                                                Short:{" "}
                                                                <strong>
                                                                    {
                                                                        line.shortfall
                                                                    }
                                                                </strong>
                                                            </span>
                                                        )}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-3">
                                <CheckoutButton visit={visit} />
                                <CancelVisitButton visit={visit} />
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
