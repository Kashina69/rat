"use client";

import { useSocket } from "@/providers/socket-provider";

// SocketProvider is the single owner of socket-driven query invalidation, so
// call sites keep using this hook without registering a second listener set.
export function useSocketInvalidation() {
    return useSocket();
}
