"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
    EmptyState,
    ErrorState,
    LoadingState,
} from "@/components/common/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useArchiveItem, useSheds, useUpdateItem } from "@/hooks/useItems";
import { apiFetch } from "@/lib/api-client";
import { friendlyMessage } from "@/lib/errors";
import { queryKeys } from "@/lib/query-keys";
import type { InventoryItem } from "@/types/api";
import { ItemEditor } from "./ItemEditor";
import { AdjustDialog, StockInDialog } from "./StockDialogs";

type DialogKind = "editor" | "stock-in" | "adjust" | null;

function listItemsIncludingArchived(shed?: string): Promise<InventoryItem[]> {
    const params = new URLSearchParams({ includeInactive: "true" });
    if (shed) params.set("shed", shed);
    return apiFetch<InventoryItem[]>(`/api/items?${params.toString()}`);
}

export function InventoryTable() {
    const [shed, setShed] = useState("");
    const itemsQuery = useQuery({
        queryKey: [...queryKeys.items(shed || "all"), "withInactive"],
        queryFn: () => listItemsIncludingArchived(shed || undefined),
    });
    const shedsQuery = useSheds();
    const archive = useArchiveItem();
    const updateItem = useUpdateItem();
    const [dialog, setDialog] = useState<DialogKind>(null);
    const [creating, setCreating] = useState(false);
    const [selected, setSelected] = useState<InventoryItem | null>(null);

    function open(kind: Exclude<DialogKind, null>, item: InventoryItem | null) {
        setSelected(item);
        setCreating(item === null);
        setDialog(kind);
    }

    if (itemsQuery.isPending)
        return <LoadingState label="Loading inventory…" />;
    if (itemsQuery.isError) {
        return (
            <ErrorState
                message="Could not load inventory."
                onRetry={() => void itemsQuery.refetch()}
            />
        );
    }

    const items = itemsQuery.data ?? [];

    return (
        <div className="flex flex-col gap-4">
            {/* Filter and action bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="w-full sm:w-56">
                        <Select
                            value={shed}
                            onChange={(e) => setShed(e.target.value)}
                            aria-label="Filter by shed"
                        >
                            <option value="">All sheds</option>
                            {(shedsQuery.data ?? []).map((row) => (
                                <option key={row.id} value={row.code}>
                                    Shed {row.code}
                                </option>
                            ))}
                        </Select>
                    </div>
                    {shedsQuery.isError && (
                        <span className="text-xs text-warning">
                            Shed filter unavailable — showing all sheds.
                        </span>
                    )}
                </div>

                <Button
                    type="button"
                    onClick={() => open("editor", null)}
                    className="gap-2 sm:self-auto"
                >
                    <Plus className="size-4" />
                    <span>New item</span>
                </Button>
            </div>

            {/* Table */}
            {items.length === 0 ? (
                <EmptyState
                    title="No inventory items found"
                    hint={
                        shed
                            ? "No items match the selected shed filter."
                            : "Add your first item to start tracking depot stock."
                    }
                    action={
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => open("editor", null)}
                        >
                            <Plus className="size-4" />
                            <span>Create first item</span>
                        </Button>
                    }
                />
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Shed</TableHead>
                            <TableHead className="text-right">
                                Current stock
                            </TableHead>
                            <TableHead className="text-right">
                                Reorder level
                            </TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">
                                Actions
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item) => {
                            const isLow =
                                item.currentStock <= item.reorderLevel;
                            return (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-foreground">
                                                {item.name}
                                            </span>
                                            {isLow && item.isActive && (
                                                <span className="text-xs font-medium text-warning">
                                                    Low stock alert
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {item.category}
                                    </TableCell>
                                    <TableCell>
                                        <span className="inline-flex items-center rounded-md bg-subtle-strong px-2 py-0.5 text-xs font-semibold text-foreground">
                                            {item.shed.code}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right font-medium tabular-nums">
                                        <span
                                            className={
                                                isLow && item.isActive
                                                    ? "font-bold text-danger"
                                                    : ""
                                            }
                                        >
                                            {item.currentStock} {item.unit}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground tabular-nums">
                                        {item.reorderLevel} {item.unit}
                                    </TableCell>
                                    <TableCell>
                                        {item.isActive ? (
                                            <Badge variant="success">
                                                Active
                                            </Badge>
                                        ) : (
                                            <Badge variant="destructive">
                                                Archived
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    open("stock-in", item)
                                                }
                                            >
                                                Stock in
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    open("adjust", item)
                                                }
                                            >
                                                Adjust
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    open("editor", item)
                                                }
                                            >
                                                Edit
                                            </Button>
                                            {item.isActive ? (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-danger hover:bg-danger-surface hover:text-danger"
                                                    disabled={archive.isPending}
                                                    onClick={async () => {
                                                        try {
                                                            await archive.mutateAsync(
                                                                item.id,
                                                            );
                                                            toast.success(
                                                                `${item.name} archived`,
                                                            );
                                                        } catch (error) {
                                                            toast.error(
                                                                friendlyMessage(
                                                                    error,
                                                                ),
                                                            );
                                                        }
                                                    }}
                                                >
                                                    Archive
                                                </Button>
                                            ) : (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="secondary"
                                                    disabled={
                                                        updateItem.isPending
                                                    }
                                                    onClick={async () => {
                                                        try {
                                                            await updateItem.mutateAsync(
                                                                {
                                                                    id: item.id,
                                                                    input: {
                                                                        isActive: true,
                                                                    },
                                                                },
                                                            );
                                                            toast.success(
                                                                `${item.name} restored`,
                                                            );
                                                        } catch (error) {
                                                            toast.error(
                                                                friendlyMessage(
                                                                    error,
                                                                ),
                                                            );
                                                        }
                                                    }}
                                                >
                                                    Restore
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            )}

            <ItemEditor
                item={creating ? null : selected}
                open={dialog === "editor"}
                onClose={() => setDialog(null)}
            />
            <StockInDialog
                item={selected}
                open={dialog === "stock-in"}
                onClose={() => setDialog(null)}
            />
            <AdjustDialog
                item={selected}
                open={dialog === "adjust"}
                onClose={() => setDialog(null)}
            />
        </div>
    );
}
