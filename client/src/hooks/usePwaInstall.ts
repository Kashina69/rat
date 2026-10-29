"use client";

import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
    if (typeof window === "undefined") return false;
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    return (navigator as { standalone?: boolean }).standalone === true;
}

export function usePwaInstall() {
    const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
        null,
    );
    const [installed, setInstalled] = useState(isStandalone);
    const isIOS =
        typeof navigator !== "undefined" &&
        /iPad|iPhone|iPod/.test(navigator.userAgent);

    useEffect(() => {
        const onPrompt = (event: Event) => {
            event.preventDefault();
            setDeferred(event as BeforeInstallPromptEvent);
        };
        const onInstalled = () => {
            setDeferred(null);
            setInstalled(true);
        };
        window.addEventListener("beforeinstallprompt", onPrompt);
        window.addEventListener("appinstalled", onInstalled);
        return () => {
            window.removeEventListener("beforeinstallprompt", onPrompt);
            window.removeEventListener("appinstalled", onInstalled);
        };
    }, []);

    const promptInstall = useCallback(async () => {
        if (!deferred) return false;
        await deferred.prompt();
        const choice = await deferred.userChoice;
        if (choice.outcome === "accepted") setDeferred(null);
        return choice.outcome === "accepted";
    }, [deferred]);

    return {
        canInstall: deferred !== null && !installed,
        isIOS,
        installed,
        promptInstall,
    };
}
