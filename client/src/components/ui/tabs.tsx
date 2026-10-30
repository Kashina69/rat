"use client";

import {
    type ButtonHTMLAttributes,
    createContext,
    type HTMLAttributes,
    type KeyboardEvent,
    useCallback,
    useContext,
    useId,
    useMemo,
    useState,
} from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
    value: string;
    setValue: (value: string) => void;
    baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs() {
    const context = useContext(TabsContext);
    if (!context) {
        throw new Error("Tabs components must be used inside <Tabs>");
    }
    return context;
}

export interface TabsProps extends HTMLAttributes<HTMLDivElement> {
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
}

export function Tabs({
    value: controlledValue,
    defaultValue = "",
    onValueChange,
    className,
    children,
    ...props
}: TabsProps) {
    const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
    const value = controlledValue ?? uncontrolledValue;
    const baseId = useId();

    const setValue = useCallback(
        (next: string) => {
            setUncontrolledValue(next);
            onValueChange?.(next);
        },
        [onValueChange],
    );

    const context = useMemo(
        () => ({ value, setValue, baseId }),
        [value, setValue, baseId],
    );

    return (
        <TabsContext.Provider value={context}>
            <div className={cn("flex flex-col gap-4", className)} {...props}>
                {children}
            </div>
        </TabsContext.Provider>
    );
}

export function TabsList({
    className,
    onKeyDown,
    ...props
}: HTMLAttributes<HTMLDivElement>) {
    const { setValue } = useTabs();

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
            return;
        }

        const tabs = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>(
                '[role="tab"]:not(:disabled)',
            ),
        );
        if (tabs.length === 0) return;

        const currentIndex = tabs.indexOf(
            document.activeElement as HTMLButtonElement,
        );
        const nextIndex =
            event.key === "Home"
                ? 0
                : event.key === "End"
                  ? tabs.length - 1
                  : event.key === "ArrowRight"
                    ? (currentIndex + 1 + tabs.length) % tabs.length
                    : (currentIndex - 1 + tabs.length) % tabs.length;
        const nextTab = tabs[nextIndex];

        event.preventDefault();
        nextTab.focus();
        if (nextTab.dataset.value) setValue(nextTab.dataset.value);
    };

    return (
        <div
            role="tablist"
            onKeyDown={handleKeyDown}
            className={cn(
                "inline-flex w-full items-center gap-1 rounded-[10px] bg-subtle p-1",
                className,
            )}
            {...props}
        />
    );
}

export interface TabsTriggerProps
    extends ButtonHTMLAttributes<HTMLButtonElement> {
    value: string;
}

export function TabsTrigger({
    value,
    className,
    children,
    onClick,
    ...props
}: TabsTriggerProps) {
    const context = useTabs();
    const active = context.value === value;

    return (
        <button
            type="button"
            role="tab"
            id={`${context.baseId}-tab-${value}`}
            data-value={value}
            aria-selected={active}
            aria-controls={`${context.baseId}-panel-${value}`}
            tabIndex={active ? 0 : -1}
            onClick={(event) => {
                onClick?.(event);
                context.setValue(value);
            }}
            className={cn(
                "inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-[10px] px-4 text-base font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                active
                    ? "bg-card text-brand-800 shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                className,
            )}
            {...props}
        >
            {children}
        </button>
    );
}

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
    value: string;
}

export function TabsContent({
    value,
    className,
    children,
    ...props
}: TabsContentProps) {
    const context = useTabs();
    if (context.value !== value) return null;

    return (
        <div
            role="tabpanel"
            id={`${context.baseId}-panel-${value}`}
            aria-labelledby={`${context.baseId}-tab-${value}`}
            className={cn("focus-visible:outline-none", className)}
            {...props}
        >
            {children}
        </div>
    );
}
