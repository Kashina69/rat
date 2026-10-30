"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {editing ? `Edit ${item?.name}` : "New item"}
                    </DialogTitle>
                    <DialogDescription>
                        {editing
                            ? "Stock quantities are managed via Stock In and Adjust, not here."
                            : "Creates the item with an initial opening ledger entry."}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-2">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="item-name">Name</Label>
                        <Input
                            id="item-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. UltraTech Cement 50kg"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="item-category">Category</Label>
                        <Input
                            id="item-category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            placeholder="e.g. Cement, Steel, Aggregate"
                        />
                    </div>

                    {!editing && (
                        <>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="item-unit">
                                    Unit of measure
                                </Label>
                                <Input
                                    id="item-unit"
                                    value={unit}
                                    onChange={(e) => setUnit(e.target.value)}
                                    placeholder="e.g. bags, kg, pcs, tonnes"
                                />
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="item-shed">Shed</Label>
                                    <Select
                                        id="item-shed"
                                        value={shedId}
                                        onChange={(e) =>
                                            setShedId(e.target.value)
                                        }
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
                                    </Select>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="item-opening">
                                        Opening stock
                                    </Label>
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
                                </div>
                            </div>
                        </>
                    )}

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="item-reorder">Reorder level</Label>
                        <Input
                            id="item-reorder"
                            value={reorder}
                            onChange={(e) => setReorder(e.target.value)}
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                        />
                    </div>

                    {error && <Alert variant="danger">{error}</Alert>}

                    {offline && (
                        <Alert variant="warning">
                            You are offline. Saving requires an active network
                            connection.
                        </Alert>
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
