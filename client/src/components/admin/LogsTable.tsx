"use client";

import { Download, FileSpreadsheet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
    EmptyState,
    ErrorState,
    LoadingState,
} from "@/components/common/States";
import { LineBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
import { downloadLogsXlsx } from "@/lib/log-export";
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
    const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);
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

    useEffect(() => {
        const data = logsQuery.data;
        if (!data) return;
        const lastPage = Math.max(1, data.pagination.totalPages);
        if (page > lastPage) setPage(lastPage);
    }, [logsQuery.data, page]);

    function resetPage() {
        setPage(1);
    }

    const exportFilters = {
        vehicle: filters.vehicle,
        item: filters.item,
        shed: filters.shed,
        status: filters.status,
        from: filters.from,
        to: filters.to,
    };

    async function onExportCsv() {
        setExporting("csv");
        try {
            await downloadLogsCsv(exportFilters);
            toast.success("Logs exported as CSV");
        } catch (error) {
            toast.error(friendlyMessage(error));
        } finally {
            setExporting(null);
        }
    }

    async function onExportXlsx() {
        setExporting("xlsx");
        try {
            await downloadLogsXlsx(exportFilters);
            toast.success("Logs exported as Excel");
        } catch (error) {
            toast.error(friendlyMessage(error));
        } finally {
            setExporting(null);
        }
    }

    return (
        <div className="flex flex-col gap-5">
            {/* Action header bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-foreground">
                        Audit & Ledger Logs
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Comprehensive log of vehicle arrivals, loading actions,
                        and stock movements
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={exporting !== null}
                        onClick={() => void onExportCsv()}
                        className="gap-2"
                    >
                        <Download className="size-4" />
                        <span>
                            {exporting === "csv" ? "Exporting…" : "Export CSV"}
                        </span>
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={exporting !== null}
                        onClick={() => void onExportXlsx()}
                        className="gap-2"
                    >
                        <FileSpreadsheet className="size-4" />
                        <span>
                            {exporting === "xlsx"
                                ? "Exporting…"
                                : "Export Excel"}
                        </span>
                    </Button>
                </div>
            </div>

            {/* Filter controls */}
            <Card className="bg-card">
                <CardContent className="p-4 sm:p-5">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="logs-vehicle">Vehicle number</Label>
                            <Input
                                id="logs-vehicle"
                                value={vehicle}
                                onChange={(e) => {
                                    setVehicle(e.target.value);
                                    resetPage();
                                }}
                                placeholder="Search by vehicle registration"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="logs-item">Item</Label>
                            <Select
                                id="logs-item"
                                value={itemId}
                                onChange={(e) => {
                                    setItemId(e.target.value);
                                    resetPage();
                                }}
                            >
                                <option value="">All items</option>
                                {(itemsQuery.data ?? []).map((row) => (
                                    <option key={row.id} value={row.id}>
                                        {row.name} ({row.shed.code})
                                    </option>
                                ))}
                            </Select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="logs-shed">Shed</Label>
                            <Select
                                id="logs-shed"
                                value={shed}
                                onChange={(e) => {
                                    setShed(e.target.value);
                                    resetPage();
                                }}
                            >
                                <option value="">All sheds</option>
                                {(shedsQuery.data ?? []).map((row) => (
                                    <option key={row.id} value={row.code}>
                                        Shed {row.code}
                                    </option>
                                ))}
                            </Select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="logs-status">Status</Label>
                            <Select
                                id="logs-status"
                                value={status}
                                onChange={(e) => {
                                    setStatus(e.target.value as "" | LogStatus);
                                    resetPage();
                                }}
                            >
                                {STATUSES.map((s) => (
                                    <option key={s} value={s}>
                                        {s === "" ? "All statuses" : s}
                                    </option>
                                ))}
                            </Select>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="logs-from">From date</Label>
                            <Input
                                id="logs-from"
                                type="date"
                                value={from}
                                onChange={(e) => {
                                    setFrom(e.target.value);
                                    resetPage();
                                }}
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="logs-to">To date</Label>
                            <Input
                                id="logs-to"
                                type="date"
                                value={to}
                                onChange={(e) => {
                                    setTo(e.target.value);
                                    resetPage();
                                }}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {(shedsQuery.isError || itemsQuery.isError) && (
                <p className="text-xs text-warning">
                    Filter dropdown lists could not be loaded — type to filter
                    instead.
                </p>
            )}

            {/* Table or States */}
            {logsQuery.isPending ? (
                <LoadingState label="Loading audit logs…" />
            ) : logsQuery.isError ? (
                <ErrorState
                    message="Could not load logs."
                    onRetry={() => void logsQuery.refetch()}
                />
            ) : (
                <>
                    {logsQuery.data.rows.length === 0 ? (
                        <EmptyState
                            title="No logs found"
                            hint={
                                page > 1
                                    ? "This page is empty. Navigate back to previous page."
                                    : "Adjust search filters to view recorded ledger activity."
                            }
                        />
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Entity</TableHead>
                                    <TableHead>Actor</TableHead>
                                    <TableHead>Timestamp</TableHead>
                                    <TableHead>Details</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logsQuery.data.rows.map((row) => (
                                    <TableRow key={row.lineId}>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <LineBadge
                                                    display={row.display}
                                                />
                                                <span className="text-xs text-muted-foreground">
                                                    {row.visitStatus}
                                                </span>
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-foreground">
                                                    {row.item.name}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    Shed {row.shed} ·{" "}
                                                    {row.item.category}
                                                </span>
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-foreground">
                                                    Gate: {row.gateUser.name}
                                                </span>
                                                {row.confirmedBy ? (
                                                    <span className="text-xs text-muted-foreground">
                                                        Loaded by:{" "}
                                                        {row.confirmedBy.name}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">
                                                        Awaiting shed
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            <div className="flex flex-col tabular-nums">
                                                <span className="text-sm text-foreground">
                                                    {row.arrivalIST}
                                                </span>
                                                {row.confirmedAtIST && (
                                                    <span className="text-xs text-muted-foreground">
                                                        Confirmed:{" "}
                                                        {row.confirmedAtIST}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>

                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-foreground">
                                                    {row.vehicle}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {row.driver} ({row.party})
                                                </span>
                                                <span className="mt-0.5 text-xs font-medium tabular-nums text-foreground">
                                                    Req: {row.requested}{" "}
                                                    {row.item.unit}
                                                    {row.loaded !== null
                                                        ? ` · Got: ${row.loaded}`
                                                        : ""}
                                                    {row.shortfall !== null &&
                                                    row.shortfall > 0
                                                        ? ` (Short: ${row.shortfall})`
                                                        : ""}
                                                </span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}

                    {/* Pagination */}
                    {logsQuery.data.pagination.totalItems > 0 && (
                        <div className="flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
                            <span className="text-muted-foreground tabular-nums">
                                Showing page {logsQuery.data.pagination.page} of{" "}
                                {logsQuery.data.pagination.totalPages} (
                                {logsQuery.data.pagination.totalItems} total
                                entries)
                            </span>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => p - 1)}
                                >
                                    Previous
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={
                                        page >=
                                        Math.max(
                                            1,
                                            logsQuery.data.pagination
                                                .totalPages,
                                        )
                                    }
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
