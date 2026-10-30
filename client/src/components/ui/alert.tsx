import { cva, type VariantProps } from "class-variance-authority";
import {
    AlertTriangle,
    CheckCircle2,
    Info,
    type LucideIcon,
    XCircle,
} from "lucide-react";
import type { HTMLAttributes, OutputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const alertVariants = cva(
    "flex items-start gap-3 rounded-[14px] border p-4 text-sm leading-6",
    {
        variants: {
            variant: {
                info: "border-brand-200 bg-brand-50 text-brand-900",
                success:
                    "border-success-border bg-success-surface text-brand-900",
                warning:
                    "border-warning-border bg-warning-surface text-warning",
                danger: "border-danger-border bg-danger-surface text-danger",
            },
        },
        defaultVariants: { variant: "info" },
    },
);

const DEFAULT_ICON: Record<NonNullable<AlertProps["variant"]>, LucideIcon> = {
    info: Info,
    success: CheckCircle2,
    warning: AlertTriangle,
    danger: XCircle,
};

export interface AlertProps
    extends OutputHTMLAttributes<HTMLOutputElement>,
        VariantProps<typeof alertVariants> {
    icon?: LucideIcon | null;
}

export function Alert({
    className,
    variant,
    icon,
    children,
    ...props
}: AlertProps) {
    const resolvedVariant = variant ?? "info";
    const Icon = icon === null ? null : (icon ?? DEFAULT_ICON[resolvedVariant]);

    return (
        <output
            className={cn(
                alertVariants({ variant: resolvedVariant }),
                className,
            )}
            {...props}
        >
            {Icon && (
                <Icon aria-hidden className="mt-0.5 size-[18px] shrink-0" />
            )}
            <div className="flex min-w-0 flex-col gap-1">{children}</div>
        </output>
    );
}

export function AlertTitle({
    className,
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    return <div className={cn("font-semibold", className)} {...props} />;
}

export function AlertDescription({
    className,
    ...props
}: HTMLAttributes<HTMLParagraphElement>) {
    return <p className={cn("text-sm", className)} {...props} />;
}
