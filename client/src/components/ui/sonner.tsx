"use client";

import { Toaster } from "sonner";

export function ToastHost() {
    return (
        <Toaster
            position="top-center"
            richColors
            closeButton
            toastOptions={{
                style: {
                    minHeight: 56,
                    fontSize: 16,
                },
            }}
        />
    );
}
