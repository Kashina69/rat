"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-base font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[18px] [&_svg]:shrink-0",
    {
        variants: {
            variant: {
                default:
                    "bg-primary text-primary-foreground hover:bg-primary-hover",
                secondary:
                    "bg-secondary text-secondary-foreground hover:bg-brand-100",
                outline:
                    "border border-border-strong bg-card text-foreground hover:bg-subtle hover:border-brand-300",
                destructive: "bg-danger text-white hover:bg-danger-hover",
                ghost: "text-foreground hover:bg-subtle-strong",
            },
            size: {
                default: "px-4 py-2.5",
                sm: "min-h-[44px] px-3 py-1.5 text-sm",
                lg: "min-h-[52px] px-6 py-3 text-lg",
                icon: "size-11 min-w-11 p-0",
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
