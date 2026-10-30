"use client";

import { Inbox, RefreshCw, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SKELETON_ROWS = [
    { key: "heading", className: "h-5 w-40" },
    { key: "first", className: "h-12 w-full" },
    { key: "second", className: "h-12 w-full" },
    { key: "third", className: "h-12 w-2/3" },
];

export function LoadingState({ label = "Loading…" }: { label?: string }) {
    return (
        <output aria-live="polite" className="block py-2">
            <span className="sr-only">{label}</span>
            <div aria-hidden className="flex flex-col gap-3">
                {SKELETON_ROWS.map((row) => (
                    <Skeleton key={row.key} className={row.className} />
                ))}
            </div>
        </output>
    );
}

export function EmptyState({
    title,
    hint,
    action,
    className,
}: {
    title: string;
    hint?: ReactNode;
    action?: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "flex flex-col items-center gap-3 rounded-[14px] border border-dashed border-border-strong bg-subtle/60 px-6 py-10 text-center",
                className,
            )}
        >
            <span className="flex size-11 items-center justify-center rounded-[10px] bg-card text-muted-foreground">
                <Inbox aria-hidden className="size-5" />
            </span>
            <div className="flex flex-col gap-1">
                <p className="text-base font-semibold text-foreground">
                    {title}
                </p>
                {hint && (
                    <p className="max-w-sm text-sm text-muted-foreground">
                        {hint}
                    </p>
                )}
            </div>
            {action}
        </div>
    );
}

export function ErrorState({
    message,
    onRetry,
}: {
    message: string;
    onRetry?: () => void;
}) {
    return (
        <div
            role="alert"
            className="flex flex-col items-start gap-3 rounded-[14px] border border-danger-border bg-danger-surface px-5 py-4 text-danger sm:flex-row sm:items-center sm:justify-between"
        >
            <div className="flex items-start gap-3">
                <TriangleAlert
                    aria-hidden
                    className="mt-0.5 size-[18px] shrink-0"
                />
                <p className="text-sm font-semibold leading-6">{message}</p>
            </div>
            {onRetry && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onRetry}
                    className="border-danger-border bg-card text-danger hover:bg-card"
                >
                    <RefreshCw aria-hidden />
                    Try again
                </Button>
            )}
        </div>
    );
}
