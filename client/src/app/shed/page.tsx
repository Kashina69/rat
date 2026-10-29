"use client";

import { RoleGuard } from "@/components/layout/RoleGuard";

export default function ShedPage() {
    return (
        <RoleGuard allow={["SHED", "ADMIN"]}>
            <section className="flex flex-col gap-2 py-4">
                <h1 className="text-2xl font-bold">Shed</h1>
                <p className="text-lg text-muted">
                    Incoming queue and load confirmation arrive in Phase 05.
                </p>
            </section>
        </RoleGuard>
    );
}
