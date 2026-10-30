"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
    useEffect(() => {
        if (process.env.NODE_ENV !== "production") return;
        if (!("serviceWorker" in navigator)) return;
        navigator.serviceWorker
            .register("/sw.js", { scope: "/", updateViaCache: "none" })
            .catch(() => {
                // Registration is best-effort; app works online without it.
            });
    }, []);
    return null;
}
