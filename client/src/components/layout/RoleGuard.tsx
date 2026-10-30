"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";
import { useAuth } from "@/providers/auth-provider";
import { type Role, roleHome } from "@/types/api";

const ROLE_LABEL: Record<Role, string> = {
    ADMIN: "Admin",
    GATE: "Gate",
    SHED: "Shed",
};

export function RoleGuard({
    allow,
    children,
}: {
    allow: Role[];
    children: ReactNode;
}) {
    const { user, isAuthenticated } = useAuth();
    const router = useRouter();
    const blockedHome =
        user && !allow.includes(user.role) ? roleHome(user.role) : null;
    const redirectTo = isAuthenticated ? blockedHome : "/login";
    const lastRedirect = useRef<string | null>(null);

    useEffect(() => {
        if (!redirectTo) {
            lastRedirect.current = null;
            return;
        }
        if (lastRedirect.current === redirectTo) return;
        lastRedirect.current = redirectTo;
        router.replace(redirectTo);
    }, [redirectTo, router]);

    if (!isAuthenticated || !user) return null;
    if (!allow.includes(user.role)) {
        return (
            <main className="flex min-h-full items-center justify-center p-6">
                <p className="text-base text-muted-foreground">
                    This area is for{" "}
                    {allow.map((r) => ROLE_LABEL[r]).join(", ")} users.
                </p>
            </main>
        );
    }
    return <>{children}</>;
}
