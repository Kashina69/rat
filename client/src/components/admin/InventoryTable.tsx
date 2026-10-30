"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
    EmptyState,
    ErrorState,
    LoadingState,
} from "@/components/common/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold">Inventory</h2>
                <select
                    value={shed}
                    onChange={(e) => setShed(e.target.value)}
                    aria-label="Filter by shed"
                    className="min-h-[44px] rounded-lg border border-line-strong bg-surface-raised px-3 text-base"
                >
                    <option value="">All sheds</option>
                    {(shedsQuery.data ?? []).map((row) => (
                        <option key={row.id} value={row.code}>
                            {row.code}
                        </option>
                    ))}
                </select>
                {shedsQuery.isError && (
                    <span className="text-sm text-amber-300">
                        Shed filter unavailable — showing all sheds.
                    </span>
                )}
                <Button
                    type="button"
                    className="ml-auto"
                    onClick={() => open("editor", null)}
                >
                    New item
                </Button>
            </div>
            {items.length === 0 ? (
                <EmptyState
                    title="No items"
                    hint="Add your first item to start tracking stock."
                />
            ) : (
                <ul className="flex flex-col gap-2">
                    {items.map((item) => (
                        <li
                            key={item.id}
                            className="flex flex-col gap-2 rounded-xl border border-line bg-surface-raised p-4"
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-lg font-bold">
                                    {item.name}
                                </span>
                                {!item.isActive && (
                                    <Badge variant="destructive">
                                        Archived
                                    </Badge>
                                )}
                                <span className="text-sm text-muted">
                                    {item.category} · {item.unit} ·{" "}
                                    {item.shed.code}
                                </span>
                                <span className="ml-auto text-lg font-bold">
                                    {item.currentStock}
                                </span>
                            </div>
                            {item.currentStock <= item.reorderLevel && (
                                <span className="text-sm text-amber-300">
                                    Low stock · reorder at {item.reorderLevel}
                                </span>
                            )}
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => open("editor", item)}
                                >
                                    Edit
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => open("stock-in", item)}
                                >
                                    Stock in
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => open("adjust", item)}
                                >
                                    Adjust
                                </Button>
                                {item.isActive ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="destructive"
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
                                                    friendlyMessage(error),
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
                                        disabled={updateItem.isPending}
                                        onClick={async () => {
                                            try {
                                                await updateItem.mutateAsync({
                                                    id: item.id,
                                                    input: { isActive: true },
                                                });
                                                toast.success(
                                                    `${item.name} restored`,
                                                );
                                            } catch (error) {
                                                toast.error(
                                                    friendlyMessage(error),
                                                );
                                            }
                                        }}
                                    >
                                        Restore
                                    </Button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
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
