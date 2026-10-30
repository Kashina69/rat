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
    <div className="w-full overflow-x-auto rounded-[14px] border border-border bg-card">
        <table
            ref={ref}
            className={cn(
                "w-full border-collapse text-left text-base tabular-nums",
                className,
            )}
            {...props}
        />
    </div>
));

Table.displayName = "Table";

export function TableHeader({
    className,
    ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
    return (
        <thead
            className={cn("bg-subtle text-muted-foreground", className)}
            {...props}
        />
    );
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
            className={cn(
                "h-12 border-t border-border transition-colors duration-150 first:border-0 hover:bg-subtle/60",
                className,
            )}
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
                "h-11 px-4 text-[13px] font-semibold text-muted-foreground",
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
    return <td className={cn("h-12 px-4 py-3", className)} {...props} />;
}
