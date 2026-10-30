import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
    title: ReactNode;
    description?: ReactNode;
    children?: ReactNode;
    className?: string;
}

export function PageHeader({
    title,
    description,
    children,
    className,
}: PageHeaderProps) {
    return (
        <header
            className={cn(
                "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
                className,
            )}
        >
            <div className="flex min-w-0 flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[30px] sm:leading-tight">
                    {title}
                </h1>
                {description && (
                    <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                        {description}
                    </p>
                )}
            </div>
            {children && (
                <div className="flex flex-wrap items-center gap-2">
                    {children}
                </div>
            )}
        </header>
    );
}
