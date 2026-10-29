"use client";

import { useState } from "react";
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

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    setLoadedQty("");
                    onClose();
                }
            }}
        >
            <DialogContent>
                <DialogTitle>Confirm loading</DialogTitle>
                <DialogDescription>
                    {line
                        ? `${line.item.name} for ${line.visit.vehicleNumber} — requested ${line.requestedQty} ${line.item.unit}, stock ${line.item.currentStock}`
                        : ""}
                </DialogDescription>
                <label
                    htmlFor="confirm-loaded-qty"
                    className="flex flex-col gap-1.5"
                >
                    <span className="text-base font-semibold">Loaded qty</span>
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
                    />
                    {loadedQty !== "" && !valid && (
                        <span role="alert" className="text-base text-red-400">
                            Enter 1 to {requested}.
                        </span>
                    )}
                </label>
                {offline && (
                    <output className="text-base text-red-300">
                        You are offline. Confirmation needs a connection.
                    </output>
                )}
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                            setLoadedQty("");
                            onClose();
                        }}
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
                                        ? `FULL load confirmed (${parsed})`
                                        : `SHORT load confirmed (${parsed}/${requested})`,
                                );
                                setLoadedQty("");
                                onClose();
                            } catch (error) {
                                toast.error(friendlyMessage(error));
                            }
                        }}
                    >
                        {confirm.isPending ? "Confirming…" : "Confirm"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
