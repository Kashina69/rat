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
import { useAdjustStock, useStockIn } from "@/hooks/useItems";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { friendlyMessage } from "@/lib/errors";
import type { InventoryItem } from "@/types/api";

function sanitizeSignedQty(value: string) {
    const negative = value.trimStart().startsWith("-");
    const digits = value.replace(/\D/g, "");
    return negative ? `-${digits}` : digits;
}

function parseSignedQty(value: string) {
    return /^-?\d+$/.test(value) ? Number.parseInt(value, 10) : null;
}

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
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Stock in · {item?.name}</DialogTitle>
                    <DialogDescription>
                        Adds stock to {item?.shed.code ?? "shed"} with an IN
                        ledger entry. Quantity must be greater than zero.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-2">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="stockin-qty">Quantity</Label>
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
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="stockin-reason">
                            Reason (optional)
                        </Label>
                        <Input
                            id="stockin-reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. Purchase order #123, Supplier return"
                            maxLength={255}
                        />
                    </div>

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
                        disabled={stockIn.isPending || offline || !item}
                        onClick={async () => {
                            const parsed = Number(qty);
                            if (
                                !item ||
                                !Number.isInteger(parsed) ||
                                parsed <= 0
                            ) {
                                toast.error("Quantity must be greater than 0.");
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
                                toast.success(
                                    `Added ${parsed} ${item.unit} to stock`,
                                );
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
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Adjust · {item?.name}</DialogTitle>
                    <DialogDescription>
                        Signed adjustment value (positive to add, negative to
                        remove). Stock can never go below zero.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-2">
                    <div className="flex flex-col gap-1.5">
                        <Label
                            htmlFor="adjust-qty"
                            hint="Use a leading minus (e.g. -5) to decrement stock."
                        >
                            Quantity (signed)
                        </Label>
                        <Input
                            id="adjust-qty"
                            value={qty}
                            onChange={(e) =>
                                setQty(sanitizeSignedQty(e.target.value))
                            }
                            type="text"
                            autoComplete="off"
                            placeholder="e.g. -5 or 10"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="adjust-reason">Reason</Label>
                        <Input
                            id="adjust-reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. Damage write-off, Physical recount"
                            maxLength={255}
                        />
                    </div>

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
                        disabled={adjust.isPending || offline || !item}
                        onClick={async () => {
                            const parsed = parseSignedQty(qty);
                            if (!item || parsed === null) {
                                toast.error("Quantity must be a whole number.");
                                return;
                            }
                            if (parsed === 0) {
                                toast.error("Quantity cannot be 0.");
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
                                toast.success("Stock adjusted successfully");
                                onClose();
                            } catch (error) {
                                toast.error(friendlyMessage(error));
                            }
                        }}
                    >
                        {adjust.isPending ? "Saving…" : "Adjust stock"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
