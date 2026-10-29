import { apiFetch } from "@/lib/api-client";
import type { Shed, ShedQueue } from "@/types/api";

export function listSheds(): Promise<Shed[]> {
    return apiFetch<Shed[]>("/api/sheds");
}

export function getShedQueue(code: string): Promise<ShedQueue> {
    return apiFetch<ShedQueue>(`/api/sheds/${code}/queue`);
}
