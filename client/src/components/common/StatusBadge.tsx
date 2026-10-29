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

export function StatusBadge({ status }: { status: VisitStatus }) {
    return (
        <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
    );
}

export function LineBadge({ display }: { display: LineDisplay }) {
    return <Badge variant={DISPLAY_VARIANT[display]}>{display}</Badge>;
}

export function StaleLabel({ when }: { when: number | null }) {
    if (!when) return null;
    return (
        <span className="text-sm text-muted">
            Stale · synced {new Date(when).toLocaleTimeString()}
        </span>
    );
}
