"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCreateItem, useSheds, useUpdateItem } from "@/hooks/useItems";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { friendlyMessage } from "@/lib/errors";
import type { InventoryItem } from "@/types/api";

export function ItemEditor({
    item,
    open,
    onClose,
}: {
    item: InventoryItem | null;
    open: boolean;
    onClose: () => void;
}) {
    const { state } = useNetworkStatus();
    const shedsQuery = useSheds(item === null);
    const createItem = useCreateItem();
    const updateItem = useUpdateItem();
    const offline = state === "offline";
    const editing = item !== null;

    const [name, setName] = useState("");
    const [category, setCategory] = useState("");
    const [unit, setUnit] = useState("");
    const [shedId, setShedId] = useState("");
    const [opening, setOpening] = useState("0");
    const [reorder, setReorder] = useState("0");
    const [error, setError] = useState("");

    useEffect(() => {
        if (open) {
            setName(item?.name ?? "");
            setCategory(item?.category ?? "");
            setUnit("");
            setShedId("");
            setOpening("0");
            setReorder(String(item?.reorderLevel ?? 0));
            setError("");
        }
    }, [open, item]);

    const pending = createItem.isPending || updateItem.isPending;

    async function onSave() {
        setError("");
        if (!name.trim() || !category.trim()) {
            setError("Name and category are required.");
            return;
        }
        const reorderLevel = Number(reorder);
        if (!Number.isInteger(reorderLevel) || reorderLevel < 0) {
            setError("Reorder level must be 0 or more.");
            return;
        }
        try {
            if (editing && item) {
                await updateItem.mutateAsync({
                    id: item.id,
                    input: {
                        name: name.trim(),
                        category: category.trim(),
                        reorderLevel,
                    },
                });
                toast.success("Item updated");
            } else {
                const sid = Number(shedId);
                const stock = Number(opening);
                if (!Number.isInteger(sid) || sid <= 0) {
                    setError("Pick a shed.");
                    return;
                }
                if (!unit.trim()) {
                    setError("Unit is required.");
                    return;
                }
                if (!Number.isInteger(stock) || stock < 0) {
                    setError("Opening stock must be 0 or more.");
                    return;
                }
                await createItem.mutateAsync({
                    name: name.trim(),
                    category: category.trim(),
                    unit: unit.trim(),
                    shedId: sid,
                    currentStock: stock,
                    reorderLevel,
                });
                toast.success("Item created");
            }
            onClose();
        } catch (err) {
            toast.error(friendlyMessage(err));
        }
    }

    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent>
                <DialogTitle>
                    {editing ? `Edit ${item?.name}` : "New item"}
                </DialogTitle>
                <DialogDescription>
                    {editing
                        ? "Stock is managed via stock-in / adjust, not here."
                        : "Creates the item with an opening ledger entry."}
                </DialogDescription>
                <div className="flex flex-col gap-3">
                    <label
                        htmlFor="item-name"
                        className="flex flex-col gap-1.5"
                    >
                        <span className="text-base font-semibold">Name</span>
                        <Input
                            id="item-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Item name"
                        />
                    </label>
                    <label
                        htmlFor="item-category"
                        className="flex flex-col gap-1.5"
                    >
                        <span className="text-base font-semibold">
                            Category
                        </span>
                        <Input
                            id="item-category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            placeholder="Category"
                        />
                    </label>
                    {!editing && (
                        <>
                            <label
                                htmlFor="item-unit"
                                className="flex flex-col gap-1.5"
                            >
                                <span className="text-base font-semibold">
                                    Unit
                                </span>
                                <Input
                                    id="item-unit"
                                    value={unit}
                                    onChange={(e) => setUnit(e.target.value)}
                                    placeholder="bag / pcs / kg"
                                />
                            </label>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <label
                                    htmlFor="item-shed"
                                    className="flex flex-col gap-1.5"
                                >
                                    <span className="text-base font-semibold">
                                        Shed
                                    </span>
                                    <select
                                        id="item-shed"
                                        value={shedId}
                                        onChange={(e) =>
                                            setShedId(e.target.value)
                                        }
                                        className="min-h-[48px] rounded-lg border border-line-strong bg-surface px-3 text-base"
                                    >
                                        <option value="" disabled>
                                            Select shed
                                        </option>
                                        {(shedsQuery.data ?? []).map((shed) => (
                                            <option
                                                key={shed.id}
                                                value={shed.id}
                                            >
                                                {shed.code} · {shed.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label
                                    htmlFor="item-opening"
                                    className="flex flex-col gap-1.5"
                                >
                                    <span className="text-base font-semibold">
                                        Opening stock
                                    </span>
                                    <Input
                                        id="item-opening"
                                        value={opening}
                                        onChange={(e) =>
                                            setOpening(e.target.value)
                                        }
                                        type="number"
                                        min={0}
                                        step={1}
                                        inputMode="numeric"
                                    />
                                </label>
                            </div>
                        </>
                    )}
                    <label
                        htmlFor="item-reorder"
                        className="flex flex-col gap-1.5"
                    >
                        <span className="text-base font-semibold">
                            Reorder level
                        </span>
                        <Input
                            id="item-reorder"
                            value={reorder}
                            onChange={(e) => setReorder(e.target.value)}
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                        />
                    </label>
                    {error && (
                        <span role="alert" className="text-base text-red-400">
                            {error}
                        </span>
                    )}
                    {offline && (
                        <output className="text-base text-red-300">
                            You are offline. Saving needs a connection.
                        </output>
                    )}
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        disabled={pending || offline}
                        onClick={() => void onSave()}
                    >
                        {pending
                            ? "Saving…"
                            : editing
                              ? "Save changes"
                              : "Create item"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
