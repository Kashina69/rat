"use client";

import { InsideList } from "@/components/gate/InsideList";
import { VehicleForm } from "@/components/gate/VehicleForm";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { useSocketInvalidation } from "@/hooks/useSocket";

export default function GatePage() {
    useSocketInvalidation();
    return (
        <RoleGuard allow={["GATE", "ADMIN"]}>
            <section className="flex flex-col gap-4 py-4">
                <h1 className="text-2xl font-bold">Gate</h1>
                <VehicleForm />
                <InsideList />
            </section>
        </RoleGuard>
    );
}
