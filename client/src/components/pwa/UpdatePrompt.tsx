"use client";

import { useEffect, useState } from "react";
import { Button } from "../ui/button";

export function UpdatePrompt() {
    const [updateReady, setUpdateReady] = useState(false);

    useEffect(() => {
        if (!("serviceWorker" in navigator)) return;
        let timer: number | undefined;
        let cancelled = false;

        const armWaiting = (reg: ServiceWorkerRegistration | undefined) => {
            if (!cancelled && reg?.waiting) setUpdateReady(true);
        };

        const check = async () => {
            try {
                const reg = await navigator.serviceWorker.getRegistration("/");
                await reg?.update().catch(() => undefined);
                armWaiting(reg);
                reg?.addEventListener("updatefound", () => {
                    const worker = reg.installing;
                    if (!worker) return;
                    worker.addEventListener("statechange", () => {
                        if (worker.state === "installed") armWaiting(reg);
                    });
                });
            } catch {
                // Update check is best-effort; SW still serves the shell.
            }
        };
        void check();
        timer = window.setInterval(check, 60_000);
        const onControllerChange = () => window.location.reload();
        navigator.serviceWorker.addEventListener(
            "controllerchange",
            onControllerChange,
        );
        return () => {
            cancelled = true;
            window.clearInterval(timer);
            navigator.serviceWorker.removeEventListener(
                "controllerchange",
                onControllerChange,
            );
        };
    }, []);

    if (!updateReady) return null;

    const applyUpdate = async () => {
        try {
            const reg = await navigator.serviceWorker.getRegistration("/");
            reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
        } catch {
            window.location.reload();
        }
    };

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
                onClick={() => void applyUpdate()}
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
