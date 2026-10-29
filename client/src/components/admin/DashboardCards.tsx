"use client";

import { ErrorState, LoadingState } from "@/components/common/States";
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
    return (
        <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-line bg-surface-raised p-4">
                <p className="text-sm text-muted">Vehicles inside</p>
                <p className="mt-1 text-4xl font-bold">{data.insideCount}</p>
            </div>
            <div className="rounded-xl border border-line bg-surface-raised p-4">
                <p className="text-sm text-muted">Pending per shed</p>
                {data.perShedPending.length === 0 ? (
                    <p className="mt-1 text-lg">Queue clear</p>
                ) : (
                    <ul className="mt-1 flex flex-col gap-1 text-lg">
                        {data.perShedPending.map((row) => (
                            <li
                                key={row.shedId}
                                className="flex justify-between gap-2"
                            >
                                <span className="font-semibold">
                                    {row.shedCode ?? `#${row.shedId}`}
                                </span>
                                <span>{row.pendingLines}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div className="rounded-xl border border-line bg-surface-raised p-4">
                <p className="text-sm text-muted">
                    Low stock ({data.lowStock.length})
                </p>
                {data.lowStock.length === 0 ? (
                    <p className="mt-1 text-lg">All healthy</p>
                ) : (
                    <ul className="mt-1 flex max-h-40 flex-col gap-1 overflow-y-auto text-base">
                        {data.lowStock.map((item) => (
                            <li
                                key={item.id}
                                className="flex justify-between gap-2"
                            >
                                <span>
                                    {item.name} · {item.shed.code}
                                </span>
                                <span className="text-amber-300">
                                    {item.currentStock} {item.unit}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
