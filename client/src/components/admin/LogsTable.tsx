"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
    EmptyState,
    ErrorState,
    LoadingState,
} from "@/components/common/States";
import { LineBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useItems, useSheds } from "@/hooks/useItems";
import { downloadLogsCsv, useLogs } from "@/hooks/useLogs";
import { friendlyMessage } from "@/lib/errors";
import type { LogFilters, LogStatus } from "@/types/api";

const STATUSES: ("" | LogStatus)[] = ["", "PENDING", "LOADED", "CANCELLED"];

export function LogsTable() {
    const [vehicle, setVehicle] = useState("");
    const [itemId, setItemId] = useState("");
    const [shed, setShed] = useState("");
    const [status, setStatus] = useState<"" | LogStatus>("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [page, setPage] = useState(1);
    const [exporting, setExporting] = useState(false);
    const shedsQuery = useSheds();
    const itemsQuery = useItems();

    const filters: LogFilters = {
        vehicle: vehicle.trim() || undefined,
        item: itemId ? Number(itemId) : undefined,
        shed: shed || undefined,
        status: status || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        limit: 50,
    };

    const logsQuery = useLogs(filters);

    function resetPage() {
        setPage(1);
    }

    async function onExport() {
        setExporting(true);
        try {
            await downloadLogsCsv({
                vehicle: filters.vehicle,
                item: filters.item,
                shed: filters.shed,
                status: filters.status,
                from: filters.from,
                to: filters.to,
            });
            toast.success("Logs exported");
        } catch (error) {
            toast.error(friendlyMessage(error));
        } finally {
            setExporting(false);
        }
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold">Ledger logs</h2>
                <Button
                    type="button"
                    variant="outline"
                    className="ml-auto"
                    disabled={exporting}
                    onClick={() => void onExport()}
                >
                    {exporting ? "Exporting…" : "Export CSV"}
                </Button>
            </div>
            <div className="grid gap-2 rounded-xl border border-line bg-surface-raised p-3 sm:grid-cols-3">
                <label htmlFor="logs-vehicle" className="flex flex-col gap-1">
                    <span className="text-sm font-semibold">Vehicle</span>
                    <Input
                        id="logs-vehicle"
                        value={vehicle}
                        onChange={(e) => {
                            setVehicle(e.target.value);
                            resetPage();
                        }}
                        placeholder="Search vehicle"
                    />
                </label>
                <label htmlFor="logs-item" className="flex flex-col gap-1">
                    <span className="text-sm font-semibold">Item</span>
                    <select
                        id="logs-item"
                        value={itemId}
                        onChange={(e) => {
                            setItemId(e.target.value);
                            resetPage();
                        }}
                        className="min-h-[48px] rounded-lg border border-line-strong bg-surface px-3 text-base"
                    >
                        <option value="">All items</option>
                        {(itemsQuery.data ?? []).map((row) => (
                            <option key={row.id} value={row.id}>
                                {row.name} · {row.shed.code}
                            </option>
                        ))}
                    </select>
                </label>
                <label htmlFor="logs-shed" className="flex flex-col gap-1">
                    <span className="text-sm font-semibold">Shed</span>
                    <select
                        id="logs-shed"
                        value={shed}
                        onChange={(e) => {
                            setShed(e.target.value);
                            resetPage();
                        }}
                        className="min-h-[48px] rounded-lg border border-line-strong bg-surface px-3 text-base"
                    >
                        <option value="">All sheds</option>
                        {(shedsQuery.data ?? []).map((row) => (
                            <option key={row.id} value={row.code}>
                                {row.code}
                            </option>
                        ))}
                    </select>
                </label>
                <label htmlFor="logs-status" className="flex flex-col gap-1">
                    <span className="text-sm font-semibold">Status</span>
                    <select
                        id="logs-status"
                        value={status}
                        onChange={(e) => {
                            setStatus(e.target.value as "" | LogStatus);
                            resetPage();
                        }}
                        className="min-h-[48px] rounded-lg border border-line-strong bg-surface px-3 text-base"
                    >
                        {STATUSES.map((s) => (
                            <option key={s} value={s}>
                                {s === "" ? "All statuses" : s}
                            </option>
                        ))}
                    </select>
                </label>
                <label htmlFor="logs-from" className="flex flex-col gap-1">
                    <span className="text-sm font-semibold">From</span>
                    <Input
                        id="logs-from"
                        type="date"
                        value={from}
                        onChange={(e) => {
                            setFrom(e.target.value);
                            resetPage();
                        }}
                    />
                </label>
                <label htmlFor="logs-to" className="flex flex-col gap-1">
                    <span className="text-sm font-semibold">To</span>
                    <Input
                        id="logs-to"
                        type="date"
                        value={to}
                        onChange={(e) => {
                            setTo(e.target.value);
                            resetPage();
                        }}
                    />
                </label>
            </div>

            {logsQuery.isPending ? (
                <LoadingState label="Loading logs…" />
            ) : logsQuery.isError ? (
                <ErrorState
                    message="Could not load logs."
                    onRetry={() => void logsQuery.refetch()}
                />
            ) : logsQuery.data.rows.length === 0 ? (
                <EmptyState
                    title="No log rows"
                    hint="Adjust filters to find ledger activity."
                />
            ) : (
                <>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Vehicle</TableHead>
                                <TableHead>Shed / Item</TableHead>
                                <TableHead>Qty</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Arrival</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logsQuery.data.rows.map((row) => (
                                <TableRow key={row.lineId}>
                                    <TableCell>
                                        <span className="font-semibold">
                                            {row.vehicle}
                                        </span>
                                        <br />
                                        <span className="text-sm text-muted">
                                            {row.driver} · {row.party}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        {row.shed} · {row.item.name}
                                        <br />
                                        <span className="text-sm text-muted">
                                            {row.visitStatus}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        req {row.requested}
                                        {row.loaded !== null
                                            ? ` / got ${row.loaded}`
                                            : ""}
                                        {row.shortfall !== null &&
                                        row.shortfall > 0
                                            ? ` (short ${row.shortfall})`
                                            : ""}
                                    </TableCell>
                                    <TableCell>
                                        <LineBadge display={row.display} />
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm">
                                            {row.arrivalIST}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <div className="flex items-center justify-between text-base">
                        <span className="text-muted">
                            Page {logsQuery.data.pagination.page} of{" "}
                            {logsQuery.data.pagination.totalPages} ·{" "}
                            {logsQuery.data.pagination.totalItems} rows
                        </span>
                        <span className="flex gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => p - 1)}
                            >
                                Prev
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={
                                    page >= logsQuery.data.pagination.totalPages
                                }
                                onClick={() => setPage((p) => p + 1)}
                            >
                                Next
                            </Button>
                        </span>
                    </div>
                </>
            )}
        </div>
    );
}
