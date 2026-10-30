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
                "min-h-[48px] w-full rounded-[10px] border border-border-strong bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground transition-colors duration-150 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:focus:ring-danger-surface",
                className,
            )}
            {...props}
        />
    ),
);
Input.displayName = "Input";
