"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSheds } from "@/hooks/useItems";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useCreateUser, useUpdateUser } from "@/hooks/useUsers";
import { friendlyMessage } from "@/lib/errors";
import type { ManagedUser, Role } from "@/types/api";

const ROLES: Role[] = ["ADMIN", "GATE", "SHED"];

export function UserEditor({
    user,
    open,
    onClose,
}: {
    user: ManagedUser | null;
    open: boolean;
    onClose: () => void;
}) {
    const { state } = useNetworkStatus();
    const shedsQuery = useSheds(open);
    const createUser = useCreateUser();
    const updateUser = useUpdateUser();
    const offline = state === "offline";
    const editing = user !== null;

    const [name, setName] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState<Role>("GATE");
    const [shedId, setShedId] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) return;
        setName(user?.name ?? "");
        setUsername(user?.username ?? "");
        setPassword("");
        setRole(user?.role ?? "GATE");
        setShedId(user?.shedId ? String(user.shedId) : "");
        setError("");
    }, [open, user]);

    const pending = createUser.isPending || updateUser.isPending;

    async function onSave() {
        setError("");
        if (!name.trim()) {
            setError("Name is required.");
            return;
        }
        if (role === "SHED" && !shedId) {
            setError("Pick a shed for the SHED role.");
            return;
        }
        const nextShedId = role === "SHED" ? Number(shedId) : null;
        try {
            if (editing && user) {
                await updateUser.mutateAsync({
                    id: user.id,
                    input: {
                        name: name.trim(),
                        role,
                        shedId: nextShedId,
                    },
                });
                toast.success("User updated");
            } else {
                if (username.trim().length < 3) {
                    setError("Username must be at least 3 characters.");
                    return;
                }
                if (password.length < 8) {
                    setError("Password must be at least 8 characters.");
                    return;
                }
                await createUser.mutateAsync({
                    name: name.trim(),
                    username: username.trim(),
                    password,
                    role,
                    shedId: nextShedId,
                });
                toast.success("User created");
            }
            onClose();
        } catch (err) {
            toast.error(friendlyMessage(err));
        }
    }

    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent>
                <DialogTitle>
                    {editing ? `Edit ${user?.name}` : "New user"}
                </DialogTitle>
                <DialogDescription>
                    {editing
                        ? "Change the name, role or shed. Username is fixed."
                        : "Creates a login for the gate, a shed or another admin."}
                </DialogDescription>
                <div className="flex flex-col gap-3">
                    <label
                        htmlFor="user-name"
                        className="flex flex-col gap-1.5"
                    >
                        <span className="text-base font-semibold">Name</span>
                        <Input
                            id="user-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Full name"
                            autoComplete="off"
                        />
                    </label>
                    <label
                        htmlFor="user-username"
                        className="flex flex-col gap-1.5"
                    >
                        <span className="text-base font-semibold">
                            Username
                        </span>
                        <Input
                            id="user-username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="login name"
                            autoComplete="off"
                            autoCapitalize="none"
                            disabled={editing}
                        />
                    </label>
                    {!editing && (
                        <label
                            htmlFor="user-password"
                            className="flex flex-col gap-1.5"
                        >
                            <span className="text-base font-semibold">
                                Password
                            </span>
                            <Input
                                id="user-password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="At least 8 characters"
                                autoComplete="new-password"
                            />
                        </label>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label
                            htmlFor="user-role"
                            className="flex flex-col gap-1.5"
                        >
                            <span className="text-base font-semibold">
                                Role
                            </span>
                            <select
                                id="user-role"
                                value={role}
                                onChange={(e) => {
                                    const next = e.target.value as Role;
                                    setRole(next);
                                    if (next !== "SHED") setShedId("");
                                }}
                                className="min-h-[44px] rounded-lg border border-line-strong bg-surface px-3 text-base"
                            >
                                {ROLES.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </select>
                        </label>
                        {role === "SHED" && (
                            <label
                                htmlFor="user-shed"
                                className="flex flex-col gap-1.5"
                            >
                                <span className="text-base font-semibold">
                                    Shed
                                </span>
                                <select
                                    id="user-shed"
                                    value={shedId}
                                    onChange={(e) => setShedId(e.target.value)}
                                    className="min-h-[44px] rounded-lg border border-line-strong bg-surface px-3 text-base"
                                >
                                    <option value="" disabled>
                                        Select shed
                                    </option>
                                    {(shedsQuery.data ?? []).map((shed) => (
                                        <option key={shed.id} value={shed.id}>
                                            {shed.code} · {shed.name}
                                        </option>
                                    ))}
                                </select>
                                {shedsQuery.isError && (
                                    <span className="text-sm text-amber-300">
                                        Could not load sheds.
                                    </span>
                                )}
                            </label>
                        )}
                    </div>
                    {error && (
                        <span role="alert" className="text-base text-red-400">
                            {error}
                        </span>
                    )}
                    {offline && (
                        <output className="text-base text-red-300">
                            You are offline. Saving needs a connection.
                        </output>
                    )}
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        disabled={pending || offline}
                        onClick={() => void onSave()}
                    >
                        {pending
                            ? "Saving…"
                            : editing
                              ? "Save changes"
                              : "Create user"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
