"use client";

import { DashboardCards } from "@/components/admin/DashboardCards";
import { InventoryTable } from "@/components/admin/InventoryTable";
import { LogsTable } from "@/components/admin/LogsTable";
import { UsersTable } from "@/components/admin/UsersTable";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { useSocketInvalidation } from "@/hooks/useSocket";

export default function AdminPage() {
    useSocketInvalidation();
    return (
        <RoleGuard allow={["ADMIN"]}>
            <section className="flex flex-col gap-6 py-4">
                <h1 className="text-2xl font-bold">Admin</h1>
                <DashboardCards />
                <InventoryTable />
                <UsersTable />
                <LogsTable />
            </section>
        </RoleGuard>
    );
}
