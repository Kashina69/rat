"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold",
    {
        variants: {
            variant: {
                default: "border-line-strong bg-surface-overlay text-ink",
                success: "border-emerald-700 bg-emerald-950 text-emerald-300",
                warning: "border-amber-700 bg-amber-950 text-amber-300",
                destructive: "border-red-700 bg-red-950 text-red-300",
                info: "border-sky-700 bg-sky-950 text-sky-300",
            },
        },
        defaultVariants: { variant: "default" },
    },
);

export interface BadgeProps
    extends HTMLAttributes<HTMLSpanElement>,
        VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <span
            className={cn(badgeVariants({ variant }), className)}
            {...props}
        />
    );
}
