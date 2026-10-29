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
import { useAdjustStock, useStockIn } from "@/hooks/useItems";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { friendlyMessage } from "@/lib/errors";
import type { InventoryItem } from "@/types/api";

export function StockInDialog({
    item,
    open,
    onClose,
}: {
    item: InventoryItem | null;
    open: boolean;
    onClose: () => void;
}) {
    const { state } = useNetworkStatus();
    const stockIn = useStockIn();
    const [qty, setQty] = useState("");
    const [reason, setReason] = useState("");
    const offline = state === "offline";

    useEffect(() => {
        if (open) {
            setQty("");
            setReason("");
        }
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent>
                <DialogTitle>Stock in · {item?.name}</DialogTitle>
                <DialogDescription>
                    Adds stock with an IN ledger entry. Qty must be greater than
                    0.
                </DialogDescription>
                <div className="flex flex-col gap-3">
                    <label
                        htmlFor="stockin-qty"
                        className="flex flex-col gap-1.5"
                    >
                        <span className="text-base font-semibold">Qty</span>
                        <Input
                            id="stockin-qty"
                            value={qty}
                            onChange={(e) => setQty(e.target.value)}
                            type="number"
                            min={1}
                            step={1}
                            inputMode="numeric"
                            placeholder="e.g. 50"
                        />
                    </label>
                    <label
                        htmlFor="stockin-reason"
                        className="flex flex-col gap-1.5"
                    >
                        <span className="text-base font-semibold">
                            Reason (optional)
                        </span>
                        <Input
                            id="stockin-reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Purchase / return…"
                            maxLength={255}
                        />
                    </label>
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
                        disabled={stockIn.isPending || offline || !item}
                        onClick={async () => {
                            const parsed = Number(qty);
                            if (
                                !item ||
                                !Number.isInteger(parsed) ||
                                parsed <= 0
                            ) {
                                toast.error("Qty must be greater than 0.");
                                return;
                            }
                            try {
                                await stockIn.mutateAsync({
                                    id: item.id,
                                    input: {
                                        qty: parsed,
                                        reason: reason.trim() || undefined,
                                    },
                                });
                                toast.success(`Stocked in ${parsed}`);
                                onClose();
                            } catch (error) {
                                toast.error(friendlyMessage(error));
                            }
                        }}
                    >
                        {stockIn.isPending ? "Saving…" : "Stock in"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function AdjustDialog({
    item,
    open,
    onClose,
}: {
    item: InventoryItem | null;
    open: boolean;
    onClose: () => void;
}) {
    const { state } = useNetworkStatus();
    const adjust = useAdjustStock();
    const [qty, setQty] = useState("");
    const [reason, setReason] = useState("");
    const offline = state === "offline";

    useEffect(() => {
        if (open) {
            setQty("");
            setReason("");
        }
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent>
                <DialogTitle>Adjust · {item?.name}</DialogTitle>
                <DialogDescription>
                    Signed qty (can be negative). Reason is required. Stock can
                    never go below zero.
                </DialogDescription>
                <div className="flex flex-col gap-3">
                    <label
                        htmlFor="adjust-qty"
                        className="flex flex-col gap-1.5"
                    >
                        <span className="text-base font-semibold">
                            Qty (signed)
                        </span>
                        <Input
                            id="adjust-qty"
                            value={qty}
                            onChange={(e) => setQty(e.target.value)}
                            type="number"
                            step={1}
                            inputMode="numeric"
                            placeholder="e.g. -5 or 10"
                        />
                    </label>
                    <label
                        htmlFor="adjust-reason"
                        className="flex flex-col gap-1.5"
                    >
                        <span className="text-base font-semibold">Reason</span>
                        <Input
                            id="adjust-reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Damage / recount…"
                            maxLength={255}
                        />
                    </label>
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
                        disabled={adjust.isPending || offline || !item}
                        onClick={async () => {
                            const parsed = Number(qty);
                            if (!item || !Number.isInteger(parsed)) {
                                toast.error("Qty must be a whole number.");
                                return;
                            }
                            if (!reason.trim()) {
                                toast.error("Reason is required.");
                                return;
                            }
                            try {
                                await adjust.mutateAsync({
                                    id: item.id,
                                    input: {
                                        qty: parsed,
                                        reason: reason.trim(),
                                    },
                                });
                                toast.success("Stock adjusted");
                                onClose();
                            } catch (error) {
                                toast.error(friendlyMessage(error));
                            }
                        }}
                    >
                        {adjust.isPending ? "Saving…" : "Adjust"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
