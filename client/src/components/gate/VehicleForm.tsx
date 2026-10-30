"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type Resolver, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useItems } from "@/hooks/useItems";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useCreateVisit } from "@/hooks/useVisits";
import { friendlyMessage } from "@/lib/errors";
import {
    type CreateVisitFormInput,
    createVisitSchema,
} from "@/validations/visit";

export function VehicleForm() {
    const { state } = useNetworkStatus();
    const itemsQuery = useItems();
    const createVisit = useCreateVisit();
    const offline = state === "offline";

    const {
        register,
        control,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<CreateVisitFormInput>({
        resolver: zodResolver(
            createVisitSchema,
        ) as Resolver<CreateVisitFormInput>,
        defaultValues: {
            vehicleNumber: "",
            driverName: "",
            party: "",
            lines: [{ itemId: 0, qty: 1 }],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "lines",
    });

    const items = itemsQuery.data ?? [];
    const itemsLoading = itemsQuery.isPending;
    const itemsFailed = itemsQuery.isError;
    const itemsUnavailable = itemsLoading || itemsFailed || items.length === 0;
    const itemName = (itemId: number) =>
        items.find((item) => item.id === itemId)?.name ?? `item ${itemId}`;

    return (
        <form
            className="flex flex-col gap-4 rounded-xl border border-line bg-surface-raised p-4"
            onSubmit={handleSubmit(async (values) => {
                const lines = values.lines.map((l) => ({
                    itemId: Number(l.itemId),
                    qty: Number(l.qty),
                }));
                if (lines.some((l) => !l.itemId)) {
                    toast.error("Pick an item for every line.");
                    return;
                }
                try {
                    const result = await createVisit.mutateAsync({
                        vehicleNumber: values.vehicleNumber.trim(),
                        driverName: values.driverName.trim(),
                        party: values.party.trim(),
                        lines,
                    });
                    if (result.warnings.length > 0) {
                        toast.warning(
                            `Saved with low stock: ${result.warnings.map((w) => `${itemName(w.itemId)} needs ${w.requested}, has ${w.available}`).join("; ")}`,
                        );
                    } else {
                        toast.success(
                            `Vehicle ${result.visit.vehicleNumber} registered`,
                        );
                    }
                    reset({
                        vehicleNumber: "",
                        driverName: "",
                        party: "",
                        lines: [{ itemId: 0, qty: 1 }],
                    });
                } catch (error) {
                    toast.error(friendlyMessage(error));
                }
            })}
        >
            <h2 className="text-xl font-bold">Register vehicle</h2>
            <label htmlFor="vehicle-number" className="flex flex-col gap-1.5">
                <span className="text-base font-semibold">Vehicle number</span>
                <Input
                    {...register("vehicleNumber")}
                    id="vehicle-number"
                    placeholder="MH12AB1234"
                    autoCapitalize="characters"
                    aria-invalid={Boolean(errors.vehicleNumber)}
                />
                {errors.vehicleNumber && (
                    <span role="alert" className="text-base text-red-400">
                        {errors.vehicleNumber.message}
                    </span>
                )}
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
                <label htmlFor="driver-name" className="flex flex-col gap-1.5">
                    <span className="text-base font-semibold">Driver</span>
                    <Input
                        {...register("driverName")}
                        id="driver-name"
                        placeholder="Driver name"
                        aria-invalid={Boolean(errors.driverName)}
                    />
                    {errors.driverName && (
                        <span role="alert" className="text-base text-red-400">
                            {errors.driverName.message}
                        </span>
                    )}
                </label>
                <label htmlFor="party-name" className="flex flex-col gap-1.5">
                    <span className="text-base font-semibold">Party</span>
                    <Input
                        {...register("party")}
                        id="party-name"
                        placeholder="Party name"
                        aria-invalid={Boolean(errors.party)}
                    />
                    {errors.party && (
                        <span role="alert" className="text-base text-red-400">
                            {errors.party.message}
                        </span>
                    )}
                </label>
            </div>

            <div className="flex flex-col gap-3">
                <span className="text-base font-semibold">Items</span>
                {itemsFailed && (
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-700 bg-amber-950 p-3 text-base text-amber-100">
                        <span className="flex-1">
                            Item list failed to load — retry, or pick an item
                            after reconnect.
                        </span>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={itemsQuery.isFetching}
                            onClick={() => void itemsQuery.refetch()}
                        >
                            {itemsQuery.isFetching ? "Retrying…" : "Retry"}
                        </Button>
                    </div>
                )}
                {fields.map((field, index) => (
                    <div
                        key={field.id}
                        className="flex gap-2 rounded-lg border border-line p-2"
                    >
                        <label
                            htmlFor={`line-item-${index}`}
                            className="flex flex-1 flex-col gap-1"
                        >
                            <span className="text-sm text-muted">Item</span>
                            <select
                                {...register(`lines.${index}.itemId`)}
                                id={`line-item-${index}`}
                                disabled={itemsLoading}
                                className="min-h-[48px] w-full rounded-lg border border-line-strong bg-surface px-3 text-base text-ink"
                            >
                                <option value={0} disabled>
                                    {itemsLoading
                                        ? "Loading items…"
                                        : itemsFailed
                                          ? "Item list failed — retry after reconnect"
                                          : items.length === 0
                                            ? "No items available"
                                            : "Select item"}
                                </option>
                                {items.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name} · {item.shed.code} · stock{" "}
                                        {item.currentStock} {item.unit}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label
                            htmlFor={`line-qty-${index}`}
                            className="flex w-28 flex-col gap-1"
                        >
                            <span className="text-sm text-muted">Qty</span>
                            <Input
                                {...register(`lines.${index}.qty`)}
                                id={`line-qty-${index}`}
                                type="number"
                                min={1}
                                step={1}
                                inputMode="numeric"
                            />
                        </label>
                        <button
                            type="button"
                            aria-label={`Remove line ${index + 1}`}
                            onClick={() => remove(index)}
                            disabled={fields.length <= 1}
                            className="mt-6 flex min-h-[48px] min-w-[48px] items-center justify-center rounded-lg border border-line-strong text-xl text-muted disabled:opacity-40"
                        >
                            ×
                        </button>
                    </div>
                ))}
                {errors.lines && (
                    <span role="alert" className="text-base text-red-400">
                        Add at least one valid item with qty ≥ 1.
                    </span>
                )}
                <button
                    type="button"
                    onClick={() => append({ itemId: 0, qty: 1 })}
                    className="flex min-h-[44px] items-center justify-center rounded-lg border border-dashed border-line-strong text-base font-semibold text-ink"
                >
                    + Add item
                </button>
            </div>

            <Button
                type="submit"
                size="lg"
                disabled={createVisit.isPending || offline || itemsUnavailable}
            >
                {createVisit.isPending ? "Saving…" : "Register"}
            </Button>
            {offline && (
                <output className="text-base text-red-300">
                    You are offline. Registration needs a connection.
                </output>
            )}
            {!itemsLoading && !itemsFailed && items.length === 0 && (
                <output className="text-base text-amber-300">
                    No items are available — ask an admin to create one before
                    registering.
                </output>
            )}
        </form>
    );
}
