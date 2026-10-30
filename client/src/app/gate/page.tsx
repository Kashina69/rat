"use client";

import { InsideList } from "@/components/gate/InsideList";
import { VehicleForm } from "@/components/gate/VehicleForm";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { PageHeader } from "@/components/ui/page-header";
import { useSocketInvalidation } from "@/hooks/useSocket";

export default function GatePage() {
    useSocketInvalidation();
    return (
        <RoleGuard allow={["GATE", "ADMIN"]}>
            <div className="flex flex-col gap-6 py-4 sm:py-6">
                <PageHeader
                    title="Gate Operations"
                    description="Register arriving vehicles and manage departure checkouts"
                />
                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
                    <section
                        aria-label="Vehicle registration"
                        className="lg:col-span-5"
                    >
                        <VehicleForm />
                    </section>
                    <section
                        aria-label="Vehicles inside depot"
                        className="lg:col-span-7"
                    >
                        <InsideList />
                    </section>
                </div>
            </div>
        </RoleGuard>
    );
}
