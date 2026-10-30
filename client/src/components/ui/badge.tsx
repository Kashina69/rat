"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold leading-5",
    {
        variants: {
            variant: {
                default: "bg-subtle-strong text-muted-foreground",
                secondary: "bg-subtle-strong text-muted-foreground",
                success: "bg-brand-50 text-brand-800",
                warning: "bg-warning-surface text-warning",
                destructive: "bg-danger-surface text-danger",
                info: "bg-brand-100 text-brand-900",
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
