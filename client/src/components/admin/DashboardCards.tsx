"use client";

import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    Truck,
    Warehouse,
} from "lucide-react";
import { ErrorState, LoadingState } from "@/components/common/States";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { useDashboard } from "@/hooks/useDashboard";

export function DashboardCards() {
    const dashboardQuery = useDashboard();

    if (dashboardQuery.isPending)
        return <LoadingState label="Loading dashboard…" />;
    if (dashboardQuery.isError) {
        return (
            <ErrorState
                message="Could not load the dashboard."
                onRetry={() => void dashboardQuery.refetch()}
            />
        );
    }

    const data = dashboardQuery.data;
    const totalPendingLoads = data.perShedPending.reduce(
        (acc, row) => acc + row.pendingLines,
        0,
    );

    return (
        <div className="flex flex-col gap-6">
            {/* Top summary stats */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard
                    label="Vehicles inside"
                    value={data.insideCount}
                    hint={
                        data.insideCount === 1
                            ? "1 vehicle on depot premises"
                            : `${data.insideCount} vehicles on depot premises`
                    }
                    icon={Truck}
                />
                <StatCard
                    label="Pending shed loads"
                    value={totalPendingLoads}
                    hint={
                        totalPendingLoads === 0
                            ? "All shed queues are clear"
                            : `${totalPendingLoads} pending across ${data.perShedPending.length} shed${data.perShedPending.length === 1 ? "" : "s"}`
                    }
                    icon={Clock}
                />
                <StatCard
                    label="Low stock alerts"
                    value={data.lowStock.length}
                    hint={
                        data.lowStock.length === 0
                            ? "All items above reorder level"
                            : `${data.lowStock.length} item${data.lowStock.length === 1 ? "" : "s"} need replenishment`
                    }
                    icon={AlertTriangle}
                />
            </div>

            {/* Breakdown sub-cards */}
            <div className="grid gap-6 lg:grid-cols-2">
                {/* Per-shed pending queues */}
                <Card>
                    <CardHeader className="border-b border-border">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Per-shed pending queues</CardTitle>
                                <CardDescription>
                                    Active waiting lines requiring loading
                                </CardDescription>
                            </div>
                            <span className="flex size-9 items-center justify-center rounded-[10px] bg-brand-50 text-brand-700">
                                <Warehouse className="size-4" />
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {data.perShedPending.length === 0 ? (
                            <div className="flex items-center gap-3 rounded-[10px] bg-subtle p-4 text-sm text-muted-foreground">
                                <CheckCircle2 className="size-5 shrink-0 text-brand-600" />
                                <span>
                                    No pending loads. All shed queues are
                                    completely clear.
                                </span>
                            </div>
                        ) : (
                            <div className="divide-y divide-border rounded-[10px] border border-border">
                                {data.perShedPending.map((row) => (
                                    <div
                                        key={row.shedId}
                                        className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-subtle/50"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <span className="flex size-7 items-center justify-center rounded-md bg-subtle-strong font-semibold text-foreground">
                                                {row.shedCode ??
                                                    `#${row.shedId}`}
                                            </span>
                                            <span className="font-medium text-foreground">
                                                Shed{" "}
                                                {row.shedCode ?? row.shedId}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground">
                                                Pending lines:
                                            </span>
                                            <Badge
                                                variant={
                                                    row.pendingLines > 0
                                                        ? "warning"
                                                        : "default"
                                                }
                                                className="tabular-nums font-semibold"
                                            >
                                                {row.pendingLines}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Low stock items */}
                <Card>
                    <CardHeader className="border-b border-border">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Low stock items</CardTitle>
                                <CardDescription>
                                    Inventory at or below defined reorder point
                                </CardDescription>
                            </div>
                            <span className="flex size-9 items-center justify-center rounded-[10px] bg-danger-surface text-danger">
                                <AlertTriangle className="size-4" />
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {data.lowStock.length === 0 ? (
                            <div className="flex items-center gap-3 rounded-[10px] bg-subtle p-4 text-sm text-muted-foreground">
                                <CheckCircle2 className="size-5 shrink-0 text-brand-600" />
                                <span>
                                    All items healthy. Stock levels are
                                    comfortably above reorder thresholds.
                                </span>
                            </div>
                        ) : (
                            <div className="max-h-[320px] divide-y divide-border overflow-y-auto rounded-[10px] border border-border">
                                {data.lowStock.map((item) => (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-subtle/50"
                                    >
                                        <div className="flex min-w-0 flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="truncate font-semibold text-foreground">
                                                    {item.name}
                                                </span>
                                                <span className="rounded-md bg-subtle-strong px-1.5 py-0.5 text-xs text-muted-foreground">
                                                    {item.shed.code}
                                                </span>
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                                Reorder at {item.reorderLevel}{" "}
                                                {item.unit}
                                            </span>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <Badge
                                                variant="destructive"
                                                className="tabular-nums font-bold"
                                            >
                                                {item.currentStock} {item.unit}
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
