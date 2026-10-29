import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import { ToastHost } from "@/components/ui/sonner";
import { theme } from "@/lib/theme";
import { AuthProvider } from "@/providers/auth-provider";
import { QueryProvider } from "@/providers/query-provider";
import { SocketProvider } from "@/providers/socket-provider";
import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: {
        default: "DMS Depot",
        template: "%s · DMS Depot",
    },
    description:
        "Depot Management System — gate, shed, and office tablets syncing live.",
    applicationName: "DMS Depot",
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "DMS Depot",
    },
    icons: {
        icon: [
            { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
            { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
        apple: [
            { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        ],
    },
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
    themeColor: theme.background,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        <html
            lang="en"
            className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        >
            <body className="min-h-full flex flex-col bg-surface">
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
