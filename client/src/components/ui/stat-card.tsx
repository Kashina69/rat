import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
    label: string;
    value: ReactNode;
    hint?: ReactNode;
    icon?: LucideIcon;
    className?: string;
}

export function StatCard({
    label,
    value,
    hint,
    icon: Icon,
    className,
}: StatCardProps) {
    return (
        <div
            className={cn(
                "rounded-[14px] border border-border bg-card p-5",
                className,
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                    <p className="text-[13px] font-medium text-muted-foreground">
                        {label}
                    </p>
                    <p className="text-[30px] font-bold leading-none tabular-nums text-foreground">
                        {value}
                    </p>
                    {hint && (
                        <p className="text-xs text-muted-foreground">{hint}</p>
                    )}
                </div>
                {Icon && (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-50 text-brand-700">
                        <Icon aria-hidden className="size-5" />
                    </span>
                )}
            </div>
        </div>
    );
}
