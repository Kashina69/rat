"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, type = "text", ...props }, ref) => (
        <input
            ref={ref}
            type={type}
            inputMode={
                props.inputMode ??
                (type === "number" || type === "tel" ? "numeric" : undefined)
            }
            className={cn(
                "min-h-[48px] w-full rounded-lg border border-line-strong bg-surface-raised px-4 py-3 text-lg text-ink placeholder:text-muted focus:border-accent focus:outline-none disabled:opacity-50",
                className,
            )}
            {...props}
        />
    ),
);
Input.displayName = "Input";
