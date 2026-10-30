"use client";

import { Warehouse } from "lucide-react";
import { useState } from "react";
import { ErrorState, LoadingState } from "@/components/common/States";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { IncomingQueue } from "@/components/shed/IncomingQueue";
import { ShedStock } from "@/components/shed/ShedStock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { useSheds } from "@/hooks/useItems";
import { useSocketInvalidation } from "@/hooks/useSocket";
import { useAuth } from "@/providers/auth-provider";

export default function ShedPage() {
    useSocketInvalidation();
    const { user } = useAuth();
    const isAdmin = user?.role === "ADMIN";
    const shedsQuery = useSheds(isAdmin);
    const [override, setOverride] = useState("");

    const shedCode = isAdmin ? override || null : (user?.shedCode ?? null);

    const sheds = shedsQuery.data ?? [];
    const firstShedCode = sheds[0]?.code;

    return (
        <RoleGuard allow={["SHED", "ADMIN"]}>
            <div className="flex flex-col gap-6 py-4">
                <PageHeader
                    title="Shed Loading Operations"
                    description="Confirm item loading for arrived vehicles and monitor shed stock"
                >
                    {shedCode ? (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                                Active Shed:
                            </span>
                            <Badge
                                variant="info"
                                className="font-mono text-sm px-3 py-1"
                            >
                                {shedCode}
                            </Badge>
                        </div>
                    ) : isAdmin ? (
                        <Badge variant="warning" className="text-xs">
                            No shed selected
                        </Badge>
                    ) : null}
                </PageHeader>

                {isAdmin && (
                    <Card className="border-border bg-card shadow-none">
                        <CardHeader className="p-4 sm:p-5 pb-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-foreground">
                                    <Warehouse className="size-4 text-brand-700" />
                                    Admin Shed Selector
                                </CardTitle>
                                <span className="text-xs text-muted-foreground">
                                    Switch view to inspect queues and stock for
                                    any facility
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-5 pt-0">
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                                <div className="w-full sm:w-72">
                                    <Select
                                        id="admin-shed-override"
                                        aria-label="Select shed to view"
                                        value={override}
                                        onChange={(e) =>
                                            setOverride(e.target.value)
                                        }
                                        disabled={shedsQuery.isPending}
                                    >
                                        <option value="">Select a shed…</option>
                                        {sheds.map((shed) => (
                                            <option
                                                key={shed.id}
                                                value={shed.code}
                                            >
                                                {shed.code} — {shed.name}
                                            </option>
                                        ))}
                                    </Select>
                                </div>
                                {firstShedCode &&
                                    override !== firstShedCode && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                setOverride(firstShedCode)
                                            }
                                        >
                                            Quick Select: {firstShedCode}
                                        </Button>
                                    )}
                                {override && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setOverride("")}
                                    >
                                        Reset
                                    </Button>
                                )}
                            </div>
                            {shedsQuery.isPending && (
                                <div className="pt-3">
                                    <LoadingState label="Loading sheds…" />
                                </div>
                            )}
                            {shedsQuery.isError && (
                                <div className="pt-3">
                                    <ErrorState
                                        message="Could not load shed list."
                                        onRetry={() =>
                                            void shedsQuery.refetch()
                                        }
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <div className="lg:col-span-7">
                        <IncomingQueue shedCode={shedCode} />
                    </div>
                    <div className="lg:col-span-5">
                        <ShedStock shedCode={shedCode} />
                    </div>
                </div>
            </div>
        </RoleGuard>
    );
}
