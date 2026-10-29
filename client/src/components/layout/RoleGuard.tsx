"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
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

    useEffect(() => {
        if (!isAuthenticated) {
            router.replace("/login");
            return;
        }
        if (user && !allow.includes(user.role)) {
            router.replace(roleHome(user.role));
        }
    }, [isAuthenticated, user, allow, router]);

    if (!isAuthenticated || !user) return null;
    if (!allow.includes(user.role)) {
        return (
            <main className="flex min-h-full items-center justify-center p-6">
                <p className="text-lg text-ink/80">
                    This area is for{" "}
                    {allow.map((r) => ROLE_LABEL[r]).join(", ")} users.
                </p>
            </main>
        );
    }
    return <>{children}</>;
}
