"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
    EmptyState,
    ErrorState,
    LoadingState,
} from "@/components/common/States";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    useResetUserPassword,
    useUpdateUser,
    useUsers,
} from "@/hooks/useUsers";
import { friendlyMessage } from "@/lib/errors";
import { useAuth } from "@/providers/auth-provider";
import type { ManagedUser, Role } from "@/types/api";
import { UserEditor } from "./UserEditor";

type DialogKind = "editor" | "reset" | null;

const ROLE_BADGE: Record<Role, "info" | "default" | "success"> = {
    ADMIN: "info",
    GATE: "default",
    SHED: "success",
};

function ResetPasswordDialog({
    user,
    open,
    onClose,
}: {
    user: ManagedUser | null;
    open: boolean;
    onClose: () => void;
}) {
    const resetPassword = useResetUserPassword();
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (open) {
            setPassword("");
            setError("");
        }
    }, [open]);

    async function onSave() {
        setError("");
        if (!user) return;
        if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }
        try {
            await resetPassword.mutateAsync({ id: user.id, password });
            toast.success(`Password reset for ${user.username}`);
            onClose();
        } catch (err) {
            toast.error(friendlyMessage(err));
        }
    }

    return (
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
            <DialogContent>
                <DialogTitle>Reset password</DialogTitle>
                <DialogDescription>
                    {user
                        ? `Set a new password for ${user.name} (${user.username}).`
                        : "Set a new password."}
                </DialogDescription>
                <label
                    htmlFor="reset-password"
                    className="flex flex-col gap-1.5"
                >
                    <span className="text-base font-semibold">
                        New password
                    </span>
                    <Input
                        id="reset-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                    />
                </label>
                {error && (
                    <span role="alert" className="text-base text-red-400">
                        {error}
                    </span>
                )}
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        disabled={resetPassword.isPending}
                        onClick={() => void onSave()}
                    >
                        {resetPassword.isPending ? "Saving…" : "Reset password"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function UsersTable() {
    const usersQuery = useUsers();
    const updateUser = useUpdateUser();
    const { user: currentUser } = useAuth();
    const [dialog, setDialog] = useState<DialogKind>(null);
    const [selected, setSelected] = useState<ManagedUser | null>(null);

    function open(kind: Exclude<DialogKind, null>, user: ManagedUser | null) {
        setSelected(user);
        setDialog(kind);
    }

    if (usersQuery.isPending) return <LoadingState label="Loading users…" />;
    if (usersQuery.isError) {
        return (
            <ErrorState
                message="Could not load users."
                onRetry={() => void usersQuery.refetch()}
            />
        );
    }

    const users = usersQuery.data ?? [];

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold">Users</h2>
                <Button
                    type="button"
                    className="ml-auto"
                    onClick={() => open("editor", null)}
                >
                    New user
                </Button>
            </div>
            {users.length === 0 ? (
                <EmptyState
                    title="No users"
                    hint="Create a login for the gate or a shed."
                />
            ) : (
                <ul className="flex flex-col gap-2">
                    {users.map((user) => {
                        const isSelf = currentUser?.id === user.id;
                        return (
                            <li
                                key={user.id}
                                className="flex flex-col gap-2 rounded-xl border border-line bg-surface-raised p-4"
                            >
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-lg font-bold">
                                        {user.name}
                                    </span>
                                    <Badge variant={ROLE_BADGE[user.role]}>
                                        {user.role}
                                    </Badge>
                                    {!user.isActive && (
                                        <Badge variant="destructive">
                                            Disabled
                                        </Badge>
                                    )}
                                    {isSelf && (
                                        <Badge variant="warning">You</Badge>
                                    )}
                                    <span className="text-sm text-muted">
                                        @{user.username} ·{" "}
                                        {user.shed?.code ?? "No shed"}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => open("editor", user)}
                                    >
                                        Edit
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => open("reset", user)}
                                    >
                                        Reset password
                                    </Button>
                                    {user.isActive ? (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="destructive"
                                            disabled={
                                                updateUser.isPending || isSelf
                                            }
                                            title={
                                                isSelf
                                                    ? "You cannot disable your own account"
                                                    : undefined
                                            }
                                            onClick={async () => {
                                                try {
                                                    await updateUser.mutateAsync(
                                                        {
                                                            id: user.id,
                                                            input: {
                                                                isActive: false,
                                                            },
                                                        },
                                                    );
                                                    toast.success(
                                                        `${user.username} disabled`,
                                                    );
                                                } catch (err) {
                                                    toast.error(
                                                        friendlyMessage(err),
                                                    );
                                                }
                                            }}
                                        >
                                            Disable
                                        </Button>
                                    ) : (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="secondary"
                                            disabled={updateUser.isPending}
                                            onClick={async () => {
                                                try {
                                                    await updateUser.mutateAsync(
                                                        {
                                                            id: user.id,
                                                            input: {
                                                                isActive: true,
                                                            },
                                                        },
                                                    );
                                                    toast.success(
                                                        `${user.username} enabled`,
                                                    );
                                                } catch (err) {
                                                    toast.error(
                                                        friendlyMessage(err),
                                                    );
                                                }
                                            }}
                                        >
                                            Enable
                                        </Button>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
            <UserEditor
                user={dialog === "editor" ? selected : null}
                open={dialog === "editor"}
                onClose={() => setDialog(null)}
            />
            <ResetPasswordDialog
                user={selected}
                open={dialog === "reset"}
                onClose={() => setDialog(null)}
            />
        </div>
    );
}
