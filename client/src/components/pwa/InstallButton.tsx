"use client";

import { Download, Share } from "lucide-react";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { Button } from "../ui/button";

export function InstallButton() {
    const { canInstall, isIOS, installed, promptInstall } = usePwaInstall();

    if (installed) return null;
    if (isIOS && !canInstall) {
        return (
            <span
                className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex"
                title="On iPhone/iPad: Share → Add to Home Screen"
            >
                <Share className="size-4" aria-hidden />
                Add to Home Screen via Share
            </span>
        );
    }
    if (!canInstall) return null;

    return (
        <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void promptInstall()}
        >
            <Download aria-hidden />
            Install
        </Button>
    );
}
