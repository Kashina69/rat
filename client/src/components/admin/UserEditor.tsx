"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {editing ? `Edit ${user?.name}` : "New user"}
                    </DialogTitle>
                    <DialogDescription>
                        {editing
                            ? "Update name, system role, or assigned shed. Username cannot be modified."
                            : "Creates login credentials for gate personnel, shed operators, or administrators."}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-2">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="user-name">Full name</Label>
                        <Input
                            id="user-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Ramesh Kumar"
                            autoComplete="off"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label
                            htmlFor="user-username"
                            hint={
                                editing
                                    ? "Username is permanently bound to this account."
                                    : undefined
                            }
                        >
                            Username
                        </Label>
                        <Input
                            id="user-username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="e.g. ramesh.k"
                            autoComplete="off"
                            autoCapitalize="none"
                            disabled={editing}
                        />
                    </div>

                    {!editing && (
                        <div className="flex flex-col gap-1.5">
                            <Label
                                htmlFor="user-password"
                                hint="Minimum 8 characters."
                            >
                                Password
                            </Label>
                            <Input
                                id="user-password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                autoComplete="new-password"
                            />
                        </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="user-role">Role</Label>
                            <Select
                                id="user-role"
                                value={role}
                                onChange={(e) => {
                                    const next = e.target.value as Role;
                                    setRole(next);
                                    if (next !== "SHED") setShedId("");
                                }}
                            >
                                {ROLES.map((option) => (
                                    <option key={option} value={option}>
                                        {option}
                                    </option>
                                ))}
                            </Select>
                        </div>

                        {role === "SHED" && (
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="user-shed">Assigned shed</Label>
                                <Select
                                    id="user-shed"
                                    value={shedId}
                                    onChange={(e) => setShedId(e.target.value)}
                                >
                                    <option value="" disabled>
                                        Select shed
                                    </option>
                                    {(shedsQuery.data ?? []).map((shed) => (
                                        <option key={shed.id} value={shed.id}>
                                            {shed.code} · {shed.name}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                        )}
                    </div>

                    {shedsQuery.isError && role === "SHED" && (
                        <span className="text-xs text-warning">
                            Could not load sheds list.
                        </span>
                    )}

                    {error && <Alert variant="danger">{error}</Alert>}

                    {offline && (
                        <Alert variant="warning">
                            You are offline. Saving requires an active network
                            connection.
                        </Alert>
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
