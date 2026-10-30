import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import { ToastHost } from "@/components/ui/sonner";
import { brandCssVars, brandScale } from "@/lib/theme";
import { AuthProvider } from "@/providers/auth-provider";
import { QueryProvider } from "@/providers/query-provider";
import { SocketProvider } from "@/providers/socket-provider";
import "./globals.css";

const manrope = Manrope({
    variable: "--font-manrope",
    subsets: ["latin"],
    display: "swap",
});

export const metadata: Metadata = {
    title: {
        default: "RAT · Realtime Ammo Tracking",
        template: "%s · Realtime Ammo Tracking",
    },
    description:
        "Realtime Ammo Tracking (RAT) — gate, shed, and office tablets syncing live.",
    applicationName: "Realtime Ammo Tracking (RAT)",
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "Realtime Ammo Tracking (RAT)",
    },
    icons: {
        icon: [
            { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
            { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
        ],
        apple: [
            {
                url: "/icons/apple-touch-icon-180.png",
                sizes: "180x180",
                type: "image/png",
            },
        ],
    },
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    colorScheme: "light",
    themeColor: brandScale[700],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        <html
            lang="en"
            className={`${manrope.variable} h-full antialiased`}
            style={brandCssVars}
        >
            <body className="flex min-h-full flex-col bg-background text-foreground">
                <QueryProvider>
                    <AuthProvider>
                        <SocketProvider>
                            <ServiceWorkerRegistration />
                            <AppShell>{children}</AppShell>
                            <ToastHost />
                        </SocketProvider>
                    </AuthProvider>
                </QueryProvider>
            </body>
        </html>
    );
}
