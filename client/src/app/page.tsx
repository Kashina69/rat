"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/providers/auth-provider";
import { roleHome } from "@/types/api";

export default function Home() {
    const { user, isAuthenticated, initializing } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (initializing) return;
        if (!isAuthenticated || !user) {
            router.replace("/login");
            return;
        }
        router.replace(roleHome(user.role));
    }, [initializing, isAuthenticated, user, router]);

    return (
        <div className="flex min-h-[50vh] items-center justify-center">
            <p className="text-lg text-muted" aria-live="polite">
                Loading Realtime Ammo Tracking (RAT)…
            </p>
        </div>
    );
}
