import { apiFetch } from "@/lib/api-client";
import type { CreateVisitInput, CreateVisitResponse, Visit } from "@/types/api";

export function createVisitRequest(
    input: CreateVisitInput,
): Promise<CreateVisitResponse> {
    return apiFetch<CreateVisitResponse>("/api/visits", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export function listInsideVisits(): Promise<Visit[]> {
    return apiFetch<Visit[]>("/api/visits?status=inside");
}

export function cancelVisitRequest(id: number): Promise<Visit> {
    return apiFetch<Visit>(`/api/visits/${id}/cancel`, { method: "POST" });
}

export function checkoutVisitRequest(id: number): Promise<Visit> {
    return apiFetch<Visit>(`/api/visits/${id}/checkout`, { method: "POST" });
}

export function cancelLineRequest(id: number) {
    return apiFetch(`/api/requirement-lines/${id}/cancel`, {
        method: "POST",
    });
}

export function confirmLineRequest(id: number, loadedQty: number) {
    return apiFetch(`/api/requirement-lines/${id}/confirm`, {
        method: "POST",
        body: JSON.stringify({ loadedQty }),
    });
}
