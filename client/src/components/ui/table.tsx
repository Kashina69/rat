"use client";

import {
    forwardRef,
    type HTMLAttributes,
    type TableHTMLAttributes,
    type TdHTMLAttributes,
    type ThHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

export const Table = forwardRef<
    HTMLTableElement,
    TableHTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
    <div className="w-full overflow-x-auto rounded-lg border border-line">
        <table
            ref={ref}
            className={cn("w-full text-left text-base", className)}
            {...props}
        />
    </div>
));

Table.displayName = "Table";

export function TableHeader({
    className,
    ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
    return <thead className={cn("bg-surface-raised", className)} {...props} />;
}

export function TableBody({
    className,
    ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
    return <tbody className={cn("", className)} {...props} />;
}

export function TableRow({
    className,
    ...props
}: HTMLAttributes<HTMLTableRowElement>) {
    return (
        <tr
            className={cn("border-t border-line first:border-0", className)}
            {...props}
        />
    );
}

export function TableHead({
    className,
    ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
    return (
        <th
            className={cn(
                "px-4 py-3 text-sm font-semibold uppercase tracking-wide text-muted",
                className,
            )}
            {...props}
        />
    );
}

export function TableCell({
    className,
    ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
    return (
        <td className={cn("min-h-[48px] px-4 py-3", className)} {...props} />
    );
}
