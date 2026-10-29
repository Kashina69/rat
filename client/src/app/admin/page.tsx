"use client";

import { RoleGuard } from "@/components/layout/RoleGuard";

export default function AdminPage() {
    return (
        <RoleGuard allow={["ADMIN"]}>
            <section className="flex flex-col gap-2 py-4">
                <h1 className="text-2xl font-bold">Admin</h1>
                <p className="text-lg text-muted">
                    Inventory, logs, and dashboard arrive in Phase 05.
                </p>
            </section>
        </RoleGuard>
    );
}
