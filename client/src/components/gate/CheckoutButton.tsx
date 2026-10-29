"use client";

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

    return (
        <div className="flex flex-col gap-1">
            <Button
                type="button"
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
                {checkout.isPending ? "Checking out…" : "Check out"}
            </Button>
            {(reason || offline) && (
                <span className="text-sm text-muted">
                    {offline
                        ? "Offline — checkout needs a connection."
                        : reason}
                </span>
            )}
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
        >
            {cancel.isPending ? "Cancelling…" : "Cancel visit"}
        </Button>
    );
}
