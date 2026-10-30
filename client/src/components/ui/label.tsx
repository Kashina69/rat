import { forwardRef, type LabelHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
    hint?: ReactNode;
    error?: ReactNode;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
    ({ className, children, hint, error, ...props }, ref) => (
        // biome-ignore lint/a11y/noLabelWithoutControl: association comes from the htmlFor passed by callers
        <label
            ref={ref}
            className={cn(
                "flex flex-col gap-1.5 text-sm font-semibold text-foreground",
                className,
            )}
            {...props}
        >
            <span>{children}</span>
            {error ? (
                <span
                    role="alert"
                    className="text-[13px] font-normal text-danger"
                >
                    {error}
                </span>
            ) : (
                hint && (
                    <span className="text-[13px] font-normal text-muted-foreground">
                        {hint}
                    </span>
                )
            )}
        </label>
    ),
);
Label.displayName = "Label";
