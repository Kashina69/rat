import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface SeparatorProps extends HTMLAttributes<HTMLHRElement> {
    orientation?: "horizontal" | "vertical";
}

export function Separator({
    className,
    orientation = "horizontal",
    ...props
}: SeparatorProps) {
    return (
        <hr
            aria-orientation={orientation}
            className={cn(
                "shrink-0 border-0 bg-border",
                orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
                className,
            )}
            {...props}
        />
    );
}
