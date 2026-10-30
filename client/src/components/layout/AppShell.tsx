"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useAuth } from "@/providers/auth-provider";
import { roleHome } from "@/types/api";
import { ConnectionBadge } from "../pwa/ConnectionBadge";
import { InstallButton } from "../pwa/InstallButton";
import { UpdatePrompt } from "../pwa/UpdatePrompt";

const TABS = [
    { href: "/gate", label: "Gate" },
    { href: "/shed", label: "Shed" },
    { href: "/admin", label: "Admin" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
    const { user, logout } = useAuth();
    const { state } = useNetworkStatus();
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = () => {
        logout();
        toast.success("Signed out");
        router.replace("/login");
    };

    return (
        <div className="flex min-h-full flex-col bg-surface text-ink">
            <header
                className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur"
                style={{
                    paddingTop: "env(safe-area-inset-top)",
                }}
            >
                <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-2 px-4 py-3">
                    <Link
                        href={user ? roleHome(user.role) : "/login"}
                        className="text-lg font-bold tracking-tight"
                    >
                        DMS <span className="text-accent">Depot</span>
                    </Link>
                    <ConnectionBadge />
                    <div className="ml-auto flex items-center gap-2">
                        <InstallButton />
                        {user && (
                            <span className="hidden text-sm text-muted sm:inline">
                                {user.name} · {user.role}
                                {user.shedCode ? ` · ${user.shedCode}` : ""}
                            </span>
                        )}
                        {user && (
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="flex min-h-[44px] items-center rounded-lg border border-line-strong px-4 text-base font-semibold text-ink hover:bg-surface-overlay"
                            >
                                Logout
                            </button>
                        )}
                    </div>
                </div>
                {user && (
                    <nav
                        aria-label="Roles"
                        className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-4 pb-3"
                    >
                        {TABS.map((tab) => {
                            const active = pathname.startsWith(tab.href);
                            return (
                                <Link
                                    key={tab.href}
                                    href={tab.href}
                                    aria-current={active ? "page" : undefined}
                                    className={`flex min-h-[44px] flex-1 items-center justify-center rounded-lg px-4 text-base font-semibold ${
                                        active
                                            ? "bg-accent text-accent-ink"
                                            : "bg-surface-raised text-ink hover:bg-surface-overlay"
                                    }`}
                                >
                                    {tab.label}
                                </Link>
                            );
                        })}
                    </nav>
                )}
            </header>
            {state !== "online" && (
                <output
                    className={`block px-4 py-2 text-center text-base font-semibold ${
                        state === "offline"
                            ? "bg-red-950 text-red-200"
                            : "bg-amber-950 text-amber-200"
                    }`}
                >
                    {state === "offline"
                        ? "Disconnected — showing last synced data. Actions are disabled."
                        : "Connection degraded — data may be stale."}
                </output>
            )}
            <main
                className="mx-auto w-full max-w-5xl flex-1 px-4 py-4"
                style={{
                    paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
                    paddingLeft: "calc(1rem + env(safe-area-inset-left))",
                    paddingRight: "calc(1rem + env(safe-area-inset-right))",
                }}
            >
                {children}
            </main>
            <UpdatePrompt />
        </div>
    );
}
