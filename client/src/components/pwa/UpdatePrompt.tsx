"use client";

import { useEffect, useState } from "react";
import { Button } from "../ui/button";

export function UpdatePrompt() {
    const [updateReady, setUpdateReady] = useState(false);

    useEffect(() => {
        if (!("serviceWorker" in navigator)) return;
        let timer: number | undefined;
        const check = async () => {
            try {
                const reg = await navigator.serviceWorker.getRegistration("/");
                if (reg?.waiting) setUpdateReady(true);
            } catch {
                // Update check is best-effort; SW still serves the shell.
            }
        };
        void check();
        timer = window.setInterval(check, 60_000);
        const onControllerChange = () => setUpdateReady(false);
        navigator.serviceWorker.addEventListener(
            "controllerchange",
            onControllerChange,
        );
        return () => {
            window.clearInterval(timer);
            navigator.serviceWorker.removeEventListener(
                "controllerchange",
                onControllerChange,
            );
        };
    }, []);

    if (!updateReady) return null;

    return (
        <output
            className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-lg flex-wrap items-center gap-3 rounded-xl border border-amber-700 bg-amber-950 p-4 text-amber-100 shadow-xl"
            style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
            <p className="min-w-48 flex-1 text-base">
                A new version is ready. It will apply when you reload — never
                during a form or stock change.
            </p>
            <Button
                type="button"
                onClick={() => window.location.reload()}
                className="min-h-[48px]"
            >
                Reload now
            </Button>
            <Button
                type="button"
                variant="ghost"
                onClick={() => setUpdateReady(false)}
            >
                Later
            </Button>
        </output>
    );
}
