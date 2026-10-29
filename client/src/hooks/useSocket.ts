"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryKeys } from "@/lib/query-keys";
import { SOCKET_EVENTS } from "@/lib/socket-client";
import { useSocket } from "@/providers/socket-provider";

export function useSocketInvalidation() {
    const { socket } = useSocket();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!socket) return;
        const handler = () => {
            void queryClient.invalidateQueries({
                queryKey: queryKeys.all,
            });
        };
        for (const event of SOCKET_EVENTS) {
            socket.on(event, handler);
        }
        return () => {
            for (const event of SOCKET_EVENTS) {
                socket.off(event, handler);
            }
        };
    }, [socket, queryClient]);
}
