"use client";

import { RoleGuard } from "@/components/layout/RoleGuard";

export default function GatePage() {
    return (
        <RoleGuard allow={["GATE", "ADMIN"]}>
            <section className="flex flex-col gap-2 py-4">
                <h1 className="text-2xl font-bold">Gate</h1>
                <p className="text-lg text-muted">
                    Vehicle registration and checkout arrive in Phase 05. The
                    live connection badge above already reflects socket + API
                    health.
                </p>
            </section>
        </RoleGuard>
    );
}
