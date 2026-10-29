"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        <div className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col justify-center py-8">
            <h1 className="text-3xl font-bold tracking-tight">
                DMS <span className="text-accent">Depot</span>
            </h1>
            <p className="mt-2 text-lg text-muted">
                Sign in to open your tablet workspace.
            </p>
            <form
                className="mt-6 flex flex-col gap-4"
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
                <label htmlFor="username" className="flex flex-col gap-1.5">
                    <span className="text-base font-semibold">Username</span>
                    <Input
                        {...register("username")}
                        id="username"
                        autoComplete="username"
                        autoCapitalize="none"
                        aria-invalid={Boolean(errors.username)}
                    />
                    {errors.username && (
                        <span role="alert" className="text-base text-red-400">
                            {errors.username.message}
                        </span>
                    )}
                </label>
                <label htmlFor="password" className="flex flex-col gap-1.5">
                    <span className="text-base font-semibold">Password</span>
                    <Input
                        {...register("password")}
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        aria-invalid={Boolean(errors.password)}
                    />
                    {errors.password && (
                        <span role="alert" className="text-base text-red-400">
                            {errors.password.message}
                        </span>
                    )}
                </label>
                <Button
                    type="submit"
                    size="lg"
                    disabled={isSubmitting || offline}
                    className="mt-2"
                >
                    {isSubmitting ? "Signing in…" : "Sign in"}
                </Button>
                {offline && (
                    <output className="text-base text-red-300">
                        You are offline. Sign-in needs a connection.
                    </output>
                )}
            </form>
        </div>
    );
}
