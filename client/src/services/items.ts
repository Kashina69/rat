import { apiFetch } from "@/lib/api-client";
import type { InventoryItem, Shed } from "@/types/api";
import type {
    AdjustStockFormInput,
    StockInFormInput,
    UpdateItemFormInput,
} from "@/validations/item";

export interface NewItemInput {
    name: string;
    category: string;
    unit: string;
    shedId: number;
    currentStock?: number;
    reorderLevel?: number;
}

export function listItems(shed?: string): Promise<InventoryItem[]> {
    const qs = shed ? `?shed=${encodeURIComponent(shed)}` : "";
    return apiFetch<InventoryItem[]>(`/api/items${qs}`);
}

export function listSheds(): Promise<Shed[]> {
    return apiFetch<Shed[]>("/api/sheds");
}

export function createItemRequest(input: NewItemInput): Promise<InventoryItem> {
    return apiFetch<InventoryItem>("/api/items", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export function updateItemRequest(
    id: number,
    input: UpdateItemFormInput,
): Promise<InventoryItem> {
    return apiFetch<InventoryItem>(`/api/items/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
    });
}

export function archiveItemRequest(
    id: number,
): Promise<{ archived: boolean; item: InventoryItem }> {
    return apiFetch(`/api/items/${id}`, { method: "DELETE" });
}

export function stockInRequest(
    id: number,
    input: StockInFormInput,
): Promise<InventoryItem> {
    return apiFetch<InventoryItem>(`/api/items/${id}/stock-in`, {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export function adjustStockRequest(
    id: number,
    input: AdjustStockFormInput,
): Promise<InventoryItem> {
    return apiFetch<InventoryItem>(`/api/items/${id}/adjust`, {
        method: "POST",
        body: JSON.stringify(input),
    });
}
