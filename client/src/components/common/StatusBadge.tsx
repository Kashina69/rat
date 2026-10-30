"use client";

import type { BadgeProps } from "@/components/ui/badge";
import { Badge } from "@/components/ui/badge";
import type { LineDisplay, VisitStatus } from "@/types/api";

const STATUS_VARIANT: Record<VisitStatus, BadgeProps["variant"]> = {
    AWAITING_LOADING: "info",
    PARTIALLY_LOADED: "warning",
    READY_FOR_CHECKOUT: "success",
    CHECKED_OUT: "default",
    CANCELLED: "destructive",
};

const STATUS_LABEL: Record<VisitStatus, string> = {
    AWAITING_LOADING: "Awaiting loading",
    PARTIALLY_LOADED: "Partially loaded",
    READY_FOR_CHECKOUT: "Ready for checkout",
    CHECKED_OUT: "Checked out",
    CANCELLED: "Cancelled",
};

const DISPLAY_VARIANT: Record<LineDisplay, BadgeProps["variant"]> = {
    PENDING: "info",
    FULL: "success",
    SHORT: "warning",
    CANCELLED: "destructive",
};

const DISPLAY_LABEL: Record<LineDisplay, string> = {
    PENDING: "Pending",
    FULL: "Full",
    SHORT: "Short",
    CANCELLED: "Cancelled",
};

export function StatusBadge({ status }: { status: VisitStatus }) {
    return (
        <Badge variant={STATUS_VARIANT[status]}>
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            {STATUS_LABEL[status]}
        </Badge>
    );
}

export function LineBadge({ display }: { display: LineDisplay }) {
    return (
        <Badge variant={DISPLAY_VARIANT[display]}>
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            {DISPLAY_LABEL[display]}
        </Badge>
    );
}

export function StaleLabel({ when }: { when: number | null }) {
    if (!when) return null;
    return (
        <span className="text-[13px] tabular-nums text-muted-foreground">
            Stale · synced {new Date(when).toLocaleTimeString()}
        </span>
    );
}
