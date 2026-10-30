"use client";

import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
    EmptyState,
    ErrorState,
    LoadingState,
} from "@/components/common/States";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
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
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Reset password</DialogTitle>
                    <DialogDescription>
                        {user
                            ? `Set a new login password for ${user.name} (@${user.username}).`
                            : "Set a new login password."}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-4 py-2">
                    <div className="flex flex-col gap-1.5">
                        <Label
                            htmlFor="reset-password"
                            hint="Must contain at least 8 characters."
                        >
                            New password
                        </Label>
                        <Input
                            id="reset-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="At least 8 characters"
                            autoComplete="new-password"
                        />
                    </div>

                    {error && <Alert variant="danger">{error}</Alert>}
                </div>

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
    const [roleFilter, setRoleFilter] = useState<string>("ALL");

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

    const allUsers = usersQuery.data ?? [];
    const filteredUsers =
        roleFilter === "ALL"
            ? allUsers
            : allUsers.filter((u) => u.role === roleFilter);

    return (
        <div className="flex flex-col gap-4">
            {/* Filter and action bar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="w-full sm:w-56">
                    <Select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                        aria-label="Filter by role"
                    >
                        <option value="ALL">All roles</option>
                        <option value="ADMIN">Admin</option>
                        <option value="GATE">Gate</option>
                        <option value="SHED">Shed</option>
                    </Select>
                </div>

                <Button
                    type="button"
                    onClick={() => open("editor", null)}
                    className="gap-2 sm:self-auto"
                >
                    <Plus className="size-4" />
                    <span>New user</span>
                </Button>
            </div>

            {/* Table */}
            {filteredUsers.length === 0 ? (
                <EmptyState
                    title="No users found"
                    hint={
                        roleFilter !== "ALL"
                            ? `No users match the ${roleFilter} role filter.`
                            : "Create credentials to allow gate, shed, or admin login."
                    }
                    action={
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => open("editor", null)}
                        >
                            <Plus className="size-4" />
                            <span>Create first user</span>
                        </Button>
                    }
                />
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Username</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Shed assignment</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">
                                Actions
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredUsers.map((user) => {
                            const isSelf = currentUser?.id === user.id;
                            return (
                                <TableRow key={user.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-foreground">
                                                @{user.username}
                                            </span>
                                            {isSelf && (
                                                <Badge variant="warning">
                                                    You
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-medium text-foreground">
                                        {user.name}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={ROLE_BADGE[user.role]}>
                                            {user.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {user.shed ? (
                                            <span className="inline-flex items-center gap-1.5 rounded-md bg-subtle px-2 py-0.5 text-xs font-semibold text-foreground">
                                                {user.shed.code} ·{" "}
                                                {user.shed.name}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground">
                                                Depot-wide
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {user.isActive ? (
                                            <Badge variant="success">
                                                Active
                                            </Badge>
                                        ) : (
                                            <Badge variant="destructive">
                                                Disabled
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    open("editor", user)
                                                }
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() =>
                                                    open("reset", user)
                                                }
                                            >
                                                Reset
                                            </Button>
                                            {user.isActive ? (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-danger hover:bg-danger-surface hover:text-danger"
                                                    disabled={
                                                        updateUser.isPending ||
                                                        isSelf
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
                                                                friendlyMessage(
                                                                    err,
                                                                ),
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
                                                    disabled={
                                                        updateUser.isPending
                                                    }
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
                                                                friendlyMessage(
                                                                    err,
                                                                ),
                                                            );
                                                        }
                                                    }}
                                                >
                                                    Enable
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
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
