"use client";

import { FileText, LayoutDashboard, Package, Users } from "lucide-react";
import { DashboardCards } from "@/components/admin/DashboardCards";
import { InventoryTable } from "@/components/admin/InventoryTable";
import { LogsTable } from "@/components/admin/LogsTable";
import { UsersTable } from "@/components/admin/UsersTable";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSocketInvalidation } from "@/hooks/useSocket";

export default function AdminPage() {
    useSocketInvalidation();

    return (
        <RoleGuard allow={["ADMIN"]}>
            <div className="flex flex-col gap-6 py-4">
                <PageHeader
                    title="Depot Administration"
                    description="Manage inventory items, stock levels, system users, and audit logs"
                />

                <Tabs defaultValue="overview" className="gap-6">
                    <TabsList className="grid w-full grid-cols-2 sm:flex sm:w-max">
                        <TabsTrigger
                            value="overview"
                            className="gap-2 text-sm sm:text-base"
                        >
                            <LayoutDashboard className="size-4" />
                            <span>Overview</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="inventory"
                            className="gap-2 text-sm sm:text-base"
                        >
                            <Package className="size-4" />
                            <span>Inventory</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="users"
                            className="gap-2 text-sm sm:text-base"
                        >
                            <Users className="size-4" />
                            <span>Users</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="logs"
                            className="gap-2 text-sm sm:text-base"
                        >
                            <FileText className="size-4" />
                            <span>Logs</span>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview">
                        <DashboardCards />
                    </TabsContent>

                    <TabsContent value="inventory">
                        <InventoryTable />
                    </TabsContent>

                    <TabsContent value="users">
                        <UsersTable />
                    </TabsContent>

                    <TabsContent value="logs">
                        <LogsTable />
                    </TabsContent>
                </Tabs>
            </div>
        </RoleGuard>
    );
}
