"use client";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
    return (
        <output
            aria-live="polite"
            className="py-8 text-center text-lg text-muted"
        >
            {label}
        </output>
    );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
    return (
        <div className="rounded-xl border border-line bg-surface-raised p-6 text-center">
            <p className="text-lg font-semibold">{title}</p>
            {hint && <p className="mt-1 text-base text-muted">{hint}</p>}
        </div>
    );
}

export function ErrorState({
    message,
    onRetry,
}: {
    message: string;
    onRetry?: () => void;
}) {
    return (
        <div className="rounded-xl border border-red-800 bg-red-950/40 p-6 text-center">
            <p className="text-lg font-semibold text-red-200">{message}</p>
            {onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="mt-3 min-h-[44px] rounded-lg border border-red-700 px-4 text-base font-semibold text-red-100"
                >
                    Retry
                </button>
            )}
        </div>
    );
}
