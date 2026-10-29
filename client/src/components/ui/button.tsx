"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0",
    {
        variants: {
            variant: {
                default: "bg-accent text-accent-ink hover:bg-accent-hover",
                secondary: "bg-surface-overlay text-ink hover:bg-line-strong",
                outline:
                    "border border-line-strong bg-transparent text-ink hover:bg-surface-overlay",
                destructive: "bg-red-600 text-white hover:bg-red-500",
                ghost: "text-ink hover:bg-surface-overlay",
            },
            size: {
                default: "px-4 py-2.5",
                sm: "min-h-[40px] px-3 py-1.5 text-sm",
                lg: "min-h-[52px] px-6 py-3 text-lg",
                icon: "size-11 p-0",
            },
        },
        defaultVariants: { variant: "default", size: "default" },
    },
);

export interface ButtonProps
    extends ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild, ...props }, ref) => {
        const Comp = asChild ? Slot : "button";
        return (
            <Comp
                ref={ref}
                className={cn(buttonVariants({ variant, size }), className)}
                {...props}
            />
        );
    },
);
Button.displayName = "Button";
