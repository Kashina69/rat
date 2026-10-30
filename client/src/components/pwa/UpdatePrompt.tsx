"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";

export function UpdatePrompt() {
    const [updateReady, setUpdateReady] = useState(false);
    const shouldReload = useRef(false);
    const registration = useRef<ServiceWorkerRegistration | null>(null);
    const dismissedWorker = useRef<ServiceWorker | null>(null);

    useEffect(() => {
        if (!("serviceWorker" in navigator)) return;
        let cancelled = false;
        let current: ServiceWorkerRegistration | null = null;
        let watchedWorker: ServiceWorker | null = null;

        const arm = (worker: ServiceWorker | null) => {
            if (cancelled || !worker) return;
            if (worker === dismissedWorker.current) return;
            setUpdateReady(true);
        };

        const watch = (worker: ServiceWorker | null) => {
            if (!worker || worker === watchedWorker) return;
            watchedWorker = worker;
            worker.addEventListener("statechange", () => {
                if (
                    worker.state === "installed" &&
                    navigator.serviceWorker.controller
                ) {
                    arm(worker);
                }
            });
        };

        const onUpdateFound = () => watch(current?.installing ?? null);

        const onControllerChange = () => {
            if (!cancelled && shouldReload.current) {
                shouldReload.current = false;
                window.location.reload();
            }
        };

        const check = async () => {
            try {
                const reg = await navigator.serviceWorker.getRegistration("/");
                if (cancelled || !reg) return;
                if (current !== reg) {
                    current?.removeEventListener("updatefound", onUpdateFound);
                    reg.addEventListener("updatefound", onUpdateFound);
                    current = reg;
                    registration.current = reg;
                }
                arm(reg.waiting);
                watch(reg.installing);
                await reg.update();
                arm(reg.waiting);
            } catch {
                // Update checks are best-effort; the cached shell still loads.
            }
        };

        navigator.serviceWorker.addEventListener(
            "controllerchange",
            onControllerChange,
        );
        void check();
        const timer = window.setInterval(() => void check(), 60_000);

        return () => {
            cancelled = true;
            window.clearInterval(timer);
            current?.removeEventListener("updatefound", onUpdateFound);
            navigator.serviceWorker.removeEventListener(
                "controllerchange",
                onControllerChange,
            );
        };
    }, []);

    if (!updateReady) return null;

    const applyUpdate = () => {
        const waiting = registration.current?.waiting;
        if (!waiting) {
            window.location.reload();
            return;
        }
        shouldReload.current = true;
        waiting.postMessage({ type: "SKIP_WAITING" });
    };

    const dismiss = () => {
        dismissedWorker.current = registration.current?.waiting ?? null;
        setUpdateReady(false);
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
                onClick={applyUpdate}
                className="min-h-[48px]"
            >
                Reload now
            </Button>
            <Button type="button" variant="ghost" onClick={dismiss}>
                Later
            </Button>
        </output>
    );
}
