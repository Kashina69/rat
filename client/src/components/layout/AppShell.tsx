"use client";

import { LogOut, TriangleAlert, Warehouse, WifiOff } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { type Role, roleHome } from "@/types/api";
import { ConnectionBadge } from "../pwa/ConnectionBadge";
import { InstallButton } from "../pwa/InstallButton";
import { UpdatePrompt } from "../pwa/UpdatePrompt";

const ROLE_TABS: Record<Role, readonly { href: string; label: string }[]> = {
    ADMIN: [{ href: "/admin", label: "Admin" }],
    GATE: [{ href: "/gate", label: "Gate" }],
    SHED: [{ href: "/shed", label: "Shed" }],
};

const ROLE_LABEL: Record<Role, string> = {
    ADMIN: "Office admin",
    GATE: "Gate",
    SHED: "Shed",
};

function initialsOf(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
    const letters = parts.map((part) => part[0]?.toUpperCase() ?? "");
    return letters.join("") || "?";
}

export function AppShell({ children }: { children: ReactNode }) {
    const { user, logout } = useAuth();
    const { state } = useNetworkStatus();
    const pathname = usePathname();
    const router = useRouter();
    const tabs = user ? ROLE_TABS[user.role] : [];

    const handleLogout = () => {
        logout();
        toast.success("Signed out");
        router.replace("/login");
    };

    return (
        <div className="flex min-h-full flex-col bg-background text-foreground">
            <header
                className="sticky top-0 z-30 border-b border-border bg-card"
                style={{
                    paddingTop: "env(safe-area-inset-top)",
                    paddingLeft: "env(safe-area-inset-left)",
                    paddingRight: "env(safe-area-inset-right)",
                }}
            >
                <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                    <Link
                        href={user ? roleHome(user.role) : "/login"}
                        className="flex items-center gap-2.5 rounded-[10px]"
                    >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
                            <Warehouse aria-hidden className="size-5" />
                        </span>
                        <span className="text-[17px] font-bold tracking-tight text-foreground">
                            DMS Depot
                        </span>
                    </Link>

                    <ConnectionBadge />

                    <div className="ml-auto flex items-center gap-2">
                        <InstallButton />
                        {user && (
                            <div className="flex items-center gap-2">
                                <span
                                    aria-hidden
                                    className="flex size-9 items-center justify-center rounded-full bg-brand-50 text-[13px] font-bold text-brand-800"
                                >
                                    {initialsOf(user.name)}
                                </span>
                                <span className="hidden flex-col leading-tight sm:flex">
                                    <span className="text-[13px] font-semibold text-foreground">
                                        {user.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {ROLE_LABEL[user.role]}
                                        {user.shedCode
                                            ? ` · ${user.shedCode}`
                                            : ""}
                                    </span>
                                </span>
                            </div>
                        )}
                        {user && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={handleLogout}
                                aria-label="Log out"
                            >
                                <LogOut aria-hidden />
                            </Button>
                        )}
                    </div>
                </div>

                {tabs.length > 0 && (
                    <nav
                        aria-label="Roles"
                        className="mx-auto w-full max-w-7xl px-4 pb-3"
                    >
                        <div className="flex gap-1 overflow-x-auto rounded-[10px] bg-subtle p-1">
                            {tabs.map((tab) => {
                                const active = pathname.startsWith(tab.href);
                                return (
                                    <Link
                                        key={tab.href}
                                        href={tab.href}
                                        aria-current={
                                            active ? "page" : undefined
                                        }
                                        className={cn(
                                            "flex min-h-[44px] flex-1 items-center justify-center rounded-[10px] px-4 text-base font-semibold transition-colors duration-150",
                                            active
                                                ? "bg-brand-50 text-brand-800 ring-1 ring-brand-200"
                                                : "text-muted-foreground hover:text-foreground",
                                        )}
                                    >
                                        {tab.label}
                                    </Link>
                                );
                            })}
                        </div>
                    </nav>
                )}
            </header>

            {state !== "online" && (
                <output
                    className={cn(
                        "flex items-center justify-center gap-2 border-b px-4 py-2 text-center text-sm font-semibold",
                        state === "offline"
                            ? "border-danger-border bg-danger-surface text-danger"
                            : "border-warning-border bg-warning-surface text-warning",
                    )}
                >
                    {state === "offline" ? (
                        <WifiOff aria-hidden className="size-4 shrink-0" />
                    ) : (
                        <TriangleAlert
                            aria-hidden
                            className="size-4 shrink-0"
                        />
                    )}
                    <span>
                        {state === "offline"
                            ? "Disconnected — showing last synced data. Actions are disabled."
                            : "Connection degraded — data may be stale."}
                    </span>
                </output>
            )}

            <main
                className="mx-auto w-full max-w-7xl flex-1 px-4 py-5"
                style={{
                    paddingBottom:
                        "calc(1.25rem + env(safe-area-inset-bottom))",
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
