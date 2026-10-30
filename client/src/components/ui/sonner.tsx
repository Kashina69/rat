"use client";

import type { CSSProperties } from "react";
import { Toaster } from "sonner";

const toastStyle = {
    minHeight: 56,
    fontSize: 16,
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px solid var(--border)",
    backgroundColor: "var(--card)",
    color: "var(--foreground)",
    boxShadow: "0 10px 30px rgba(11, 18, 16, 0.10)",
} satisfies CSSProperties;

export function ToastHost() {
    return (
        <Toaster
            theme="light"
            position="top-center"
            closeButton
            offset={16}
            toastOptions={{
                style: toastStyle,
                classNames: {
                    closeButton: "rounded-full border-border bg-card",
                },
            }}
        />
    );
}
