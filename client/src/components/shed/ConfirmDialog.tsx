"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useConfirmLine } from "@/hooks/useVisits";
import { friendlyMessage } from "@/lib/errors";
import type { QueueLine } from "@/types/api";

export function ConfirmDialog({
    line,
    open,
    onClose,
}: {
    line: QueueLine | null;
    open: boolean;
    onClose: () => void;
}) {
    const { state } = useNetworkStatus();
    const confirm = useConfirmLine();
    const [loadedQty, setLoadedQty] = useState("");
    const offline = state === "offline";

    const requested = line?.requestedQty ?? 0;
    const parsed = Number(loadedQty);
    const valid =
        Number.isInteger(parsed) && parsed >= 1 && parsed <= requested;

    const handleClose = () => {
        setLoadedQty("");
        onClose();
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    handleClose();
                }
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Confirm Loading</DialogTitle>
                    <DialogDescription>
                        Verify and record the quantity loaded onto the vehicle.
                    </DialogDescription>
                </DialogHeader>

                {line && (
                    <div className="rounded-[12px] border border-border bg-subtle/50 p-4 text-sm">
                        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-border">
                            <span className="font-mono font-bold text-foreground text-base">
                                {line.visit.vehicleNumber}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                Driver: {line.visit.driverName}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                                <span className="text-muted-foreground block mb-0.5">
                                    Item
                                </span>
                                <span className="font-semibold text-foreground text-sm">
                                    {line.item.name}
                                </span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block mb-0.5">
                                    Requested
                                </span>
                                <span className="font-semibold tabular-nums text-foreground text-sm">
                                    {requested} {line.item.unit}
                                </span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block mb-0.5">
                                    Shed Stock
                                </span>
                                <span className="font-medium tabular-nums text-foreground">
                                    {line.item.currentStock} {line.item.unit}
                                </span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block mb-0.5">
                                    Party
                                </span>
                                <span className="font-medium text-foreground truncate block">
                                    {line.visit.party || "—"}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-2">
                    <Label
                        htmlFor="confirm-loaded-qty"
                        hint={`Enter quantity loaded (1 to ${requested} ${line?.item.unit ?? "units"})`}
                        error={
                            loadedQty !== "" && !valid
                                ? `Please enter an integer between 1 and ${requested}.`
                                : undefined
                        }
                    >
                        Loaded Quantity
                    </Label>
                    <div className="flex items-center gap-2">
                        <Input
                            id="confirm-loaded-qty"
                            type="number"
                            min={1}
                            max={requested || undefined}
                            step={1}
                            inputMode="numeric"
                            value={loadedQty}
                            onChange={(e) => setLoadedQty(e.target.value)}
                            placeholder={`1 – ${requested}`}
                            aria-invalid={loadedQty !== "" && !valid}
                            className="tabular-nums"
                            autoFocus
                        />
                        {requested > 0 && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setLoadedQty(String(requested))}
                                className="shrink-0 text-xs font-semibold"
                            >
                                Fill Full ({requested})
                            </Button>
                        )}
                    </div>
                </div>

                {offline && (
                    <Alert variant="warning">
                        <AlertTitle>Offline Mode</AlertTitle>
                        <AlertDescription>
                            You are offline. Confirming loads requires an active
                            connection.
                        </AlertDescription>
                    </Alert>
                )}

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        disabled={
                            !line || !valid || confirm.isPending || offline
                        }
                        onClick={async () => {
                            if (!line) return;
                            try {
                                await confirm.mutateAsync({
                                    id: line.id,
                                    loadedQty: parsed,
                                });
                                toast.success(
                                    parsed >= requested
                                        ? `FULL load confirmed (${parsed} ${line.item.unit})`
                                        : `SHORT load confirmed (${parsed}/${requested} ${line.item.unit})`,
                                );
                                handleClose();
                            } catch (error) {
                                toast.error(friendlyMessage(error));
                            }
                        }}
                    >
                        {confirm.isPending ? "Confirming…" : "Confirm Loading"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
