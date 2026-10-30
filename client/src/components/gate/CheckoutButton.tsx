"use client";

import { CheckCircle2, LogOut, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useCancelVisit, useCheckoutVisit } from "@/hooks/useVisits";
import { friendlyMessage } from "@/lib/errors";
import type { Visit } from "@/types/api";

function checkoutBlockReason(visit: Visit): string | null {
    if (visit.status === "READY_FOR_CHECKOUT") return null;
    if (visit.status === "CANCELLED") return "Visit cancelled";
    if (visit.status === "CHECKED_OUT") return "Already checked out";
    if (visit.status === "AWAITING_LOADING")
        return "Waiting: no lines loaded yet";
    return "Waiting: all sheds must finish loading";
}

export function CheckoutButton({ visit }: { visit: Visit }) {
    const { state } = useNetworkStatus();
    const checkout = useCheckoutVisit();
    const offline = state === "offline";
    const reason = checkoutBlockReason(visit);
    const disabled = reason !== null || checkout.isPending || offline;
    const isReady = visit.status === "READY_FOR_CHECKOUT";

    return (
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
            <Button
                type="button"
                variant={isReady ? "default" : "outline"}
                disabled={disabled}
                onClick={async () => {
                    try {
                        await checkout.mutateAsync(visit.id);
                        toast.success(
                            `Vehicle ${visit.vehicleNumber} checked out`,
                        );
                    } catch (error) {
                        toast.error(friendlyMessage(error));
                    }
                }}
            >
                <LogOut className="size-4" />
                {checkout.isPending ? "Checking out…" : "Check out"}
            </Button>
            {offline ? (
                <span className="text-xs text-danger">
                    Offline — checkout needs a connection.
                </span>
            ) : reason ? (
                <span className="text-xs text-muted-foreground">{reason}</span>
            ) : isReady ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-brand-700">
                    <CheckCircle2 className="size-3.5" />
                    Ready for departure
                </span>
            ) : null}
        </div>
    );
}

export function CancelVisitButton({ visit }: { visit: Visit }) {
    const { state } = useNetworkStatus();
    const cancel = useCancelVisit();
    const offline = state === "offline";

    if (
        visit.status === "CHECKED_OUT" ||
        visit.status === "CANCELLED" ||
        visit.lines.some((line) => line.status === "LOADED")
    ) {
        return null;
    }

    return (
        <Button
            type="button"
            variant="outline"
            disabled={cancel.isPending || offline}
            onClick={async () => {
                try {
                    await cancel.mutateAsync(visit.id);
                    toast.success(`Visit ${visit.vehicleNumber} cancelled`);
                } catch (error) {
                    toast.error(friendlyMessage(error));
                }
            }}
            className="text-muted-foreground hover:border-danger/30 hover:bg-danger-surface hover:text-danger"
        >
            <XCircle className="size-4" />
            {cancel.isPending ? "Cancelling…" : "Cancel visit"}
        </Button>
    );
}
