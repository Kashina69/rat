"use client";

import { useState } from "react";
import { ErrorState, LoadingState } from "@/components/common/States";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { IncomingQueue } from "@/components/shed/IncomingQueue";
import { ShedStock } from "@/components/shed/ShedStock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSheds } from "@/hooks/useItems";
import { useSocketInvalidation } from "@/hooks/useSocket";
import { useAuth } from "@/providers/auth-provider";

export default function ShedPage() {
    useSocketInvalidation();
    const { user } = useAuth();
    const shedsQuery = useSheds(user?.role === "ADMIN");
    const [override, setOverride] = useState("");

    const shedCode =
        user?.role === "ADMIN" ? override || null : (user?.shedCode ?? null);

    return (
        <RoleGuard allow={["SHED", "ADMIN"]}>
            <section className="flex flex-col gap-4 py-4">
                <h1 className="text-2xl font-bold">Shed</h1>
                {user?.role === "ADMIN" && (
                    <label
                        htmlFor="admin-shed-override"
                        className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface-raised p-4"
                    >
                        <span className="text-base font-semibold">
                            View queue as shed
                        </span>
                        <span className="flex gap-2">
                            <Input
                                id="admin-shed-override"
                                value={override}
                                onChange={(e) =>
                                    setOverride(e.target.value.toUpperCase())
                                }
                                placeholder="SHED-A"
                                className="uppercase"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                disabled={!shedsQuery.data}
                                onClick={() => {
                                    const first = shedsQuery.data?.[0]?.code;
                                    if (first) setOverride(first);
                                }}
                            >
                                First
                            </Button>
                        </span>
                        {shedsQuery.isPending && (
                            <LoadingState label="Loading sheds…" />
                        )}
                        {shedsQuery.isError && (
                            <ErrorState
                                message="Could not load shed list."
                                onRetry={() => void shedsQuery.refetch()}
                            />
                        )}
                    </label>
                )}
                <IncomingQueue shedCode={shedCode} />
                <ShedStock shedCode={shedCode} />
            </section>
        </RoleGuard>
    );
}
