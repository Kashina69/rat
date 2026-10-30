"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Warehouse } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { isApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import { roleHome } from "@/types/api";
import { type LoginFormInput, loginSchema } from "@/validations/auth";

export default function LoginPage() {
    const { user, isAuthenticated, login } = useAuth();
    const { state } = useNetworkStatus();
    const router = useRouter();
    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
    } = useForm<LoginFormInput>({ resolver: zodResolver(loginSchema) });

    useEffect(() => {
        if (isAuthenticated && user) {
            router.replace(roleHome(user.role));
        }
    }, [isAuthenticated, user, router]);

    const offline = state === "offline";

    return (
        <div className="flex min-h-[60vh] w-full items-center justify-center rounded-[18px] bg-subtle px-4 py-10 sm:px-8">
            <Card className="w-full max-w-md p-6 shadow-sm">
                <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
                        <Warehouse aria-hidden className="size-5" />
                    </span>
                    <span className="text-[17px] font-bold tracking-tight text-foreground">
                        DMS Depot
                    </span>
                </div>

                <h1 className="mt-6 text-xl font-bold tracking-tight text-foreground">
                    Sign in
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Open your tablet workspace for gate, shed, or office.
                </p>

                {offline && (
                    <Alert variant="warning" className="mt-4">
                        You are offline. Sign-in needs a connection.
                    </Alert>
                )}

                <form
                    className="mt-5 flex flex-col gap-4"
                    onSubmit={handleSubmit(async (values) => {
                        try {
                            const signedIn = await login(values);
                            toast.success(`Welcome, ${signedIn.name}`);
                            router.replace(roleHome(signedIn.role));
                        } catch (error) {
                            toast.error(
                                isApiError(error)
                                    ? error.message
                                    : "Login failed. Try again.",
                            );
                        }
                    })}
                >
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="username">Username</Label>
                        <Input
                            {...register("username")}
                            id="username"
                            autoComplete="username"
                            autoCapitalize="none"
                            aria-invalid={Boolean(errors.username)}
                            aria-describedby={
                                errors.username ? "username-error" : undefined
                            }
                        />
                        {errors.username && (
                            <span
                                id="username-error"
                                role="alert"
                                className="text-[13px] text-danger"
                            >
                                {errors.username.message}
                            </span>
                        )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            {...register("password")}
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            aria-invalid={Boolean(errors.password)}
                            aria-describedby={
                                errors.password ? "password-error" : undefined
                            }
                        />
                        {errors.password && (
                            <span
                                id="password-error"
                                role="alert"
                                className="text-[13px] text-danger"
                            >
                                {errors.password.message}
                            </span>
                        )}
                    </div>

                    <Button
                        type="submit"
                        size="lg"
                        disabled={isSubmitting || offline}
                        className="mt-1 w-full"
                    >
                        {isSubmitting ? "Signing in…" : "Sign in"}
                    </Button>
                </form>

                <p className="mt-6 text-center text-[13px] text-muted-foreground">
                    Gate · Shed · Office
                </p>
            </Card>
        </div>
    );
}
