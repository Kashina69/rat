import type { MetadataRoute } from "next";
import { theme } from "@/lib/theme";

export default function manifest(): MetadataRoute.Manifest {
    return {
        id: "/",
        name: "Realtime Ammo Tracking",
        short_name: "RAT",
        description:
            "Realtime Ammo Tracking (RAT) — gate, shed, and office tablets syncing live.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: theme.background,
        theme_color: theme.themeColor,
        icons: [
            {
                src: "/icons/icon-192.png",
                sizes: "192x192",
                type: "image/png",
            },
            {
                src: "/icons/icon-512.png",
                sizes: "512x512",
                type: "image/png",
            },
            {
                src: "/icons/icon-maskable-512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable",
            },
        ],
    };
}
