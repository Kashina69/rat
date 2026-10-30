"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { type Resolver, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
        <Card className="shadow-none">
            <CardHeader>
                <CardTitle>Register vehicle</CardTitle>
                <CardDescription>
                    Record vehicle arrival and assign consignment items.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
                <form
                    className="flex flex-col gap-4"
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
                                    `Saved with low stock: ${result.warnings
                                        .map(
                                            (w) =>
                                                `${itemName(w.itemId)} needs ${w.requested}, has ${w.available}`,
                                        )
                                        .join("; ")}`,
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
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="vehicle-number">Vehicle number</Label>
                        <Input
                            {...register("vehicleNumber")}
                            id="vehicle-number"
                            placeholder="e.g. MH12AB1234"
                            autoCapitalize="characters"
                            aria-invalid={Boolean(errors.vehicleNumber)}
                            aria-describedby={
                                errors.vehicleNumber
                                    ? "vehicle-number-error"
                                    : undefined
                            }
                            className="font-medium uppercase placeholder:normal-case placeholder:font-normal"
                        />
                        {errors.vehicleNumber && (
                            <span
                                id="vehicle-number-error"
                                role="alert"
                                className="text-[13px] text-danger"
                            >
                                {errors.vehicleNumber.message}
                            </span>
                        )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="driver-name">Driver</Label>
                            <Input
                                {...register("driverName")}
                                id="driver-name"
                                placeholder="Driver name"
                                aria-invalid={Boolean(errors.driverName)}
                                aria-describedby={
                                    errors.driverName
                                        ? "driver-name-error"
                                        : undefined
                                }
                            />
                            {errors.driverName && (
                                <span
                                    id="driver-name-error"
                                    role="alert"
                                    className="text-[13px] text-danger"
                                >
                                    {errors.driverName.message}
                                </span>
                            )}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="party-name">Party</Label>
                            <Input
                                {...register("party")}
                                id="party-name"
                                placeholder="Party or company"
                                aria-invalid={Boolean(errors.party)}
                                aria-describedby={
                                    errors.party ? "party-error" : undefined
                                }
                            />
                            {errors.party && (
                                <span
                                    id="party-error"
                                    role="alert"
                                    className="text-[13px] text-danger"
                                >
                                    {errors.party.message}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 pt-1">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-foreground">
                                Items
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {fields.length}{" "}
                                {fields.length === 1 ? "line" : "lines"}
                            </span>
                        </div>

                        {itemsFailed && (
                            <Alert
                                variant="warning"
                                className="flex flex-wrap items-center justify-between gap-2"
                            >
                                <span className="flex-1">
                                    Item list failed to load — retry or pick
                                    after reconnect.
                                </span>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={itemsQuery.isFetching}
                                    onClick={() => void itemsQuery.refetch()}
                                    className="border-warning/30 bg-card text-warning hover:bg-warning-surface"
                                >
                                    {itemsQuery.isFetching
                                        ? "Retrying…"
                                        : "Retry"}
                                </Button>
                            </Alert>
                        )}

                        <div className="flex flex-col gap-2.5">
                            {fields.map((field, index) => (
                                <div
                                    key={field.id}
                                    className="flex flex-col gap-3 rounded-[10px] border border-border bg-subtle/40 p-3 sm:flex-row sm:items-end"
                                >
                                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                        <Label
                                            htmlFor={`line-item-${index}`}
                                            className="text-xs font-medium text-muted-foreground"
                                        >
                                            Item
                                        </Label>
                                        <Select
                                            {...register(
                                                `lines.${index}.itemId`,
                                            )}
                                            id={`line-item-${index}`}
                                            disabled={itemsLoading}
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
                                                <option
                                                    key={item.id}
                                                    value={item.id}
                                                >
                                                    {item.name} · Shed{" "}
                                                    {item.shed.code} (stock:{" "}
                                                    {item.currentStock}{" "}
                                                    {item.unit})
                                                </option>
                                            ))}
                                        </Select>
                                    </div>

                                    <div className="flex w-full flex-col gap-1.5 sm:w-28">
                                        <Label
                                            htmlFor={`line-qty-${index}`}
                                            className="text-xs font-medium text-muted-foreground"
                                        >
                                            Qty
                                        </Label>
                                        <Input
                                            {...register(`lines.${index}.qty`)}
                                            id={`line-qty-${index}`}
                                            type="number"
                                            min={1}
                                            step={1}
                                            inputMode="numeric"
                                            className="tabular-nums"
                                        />
                                    </div>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        aria-label={`Remove line ${index + 1}`}
                                        onClick={() => remove(index)}
                                        disabled={fields.length <= 1}
                                        className="self-end shrink-0 text-muted-foreground hover:border-danger/30 hover:bg-danger-surface hover:text-danger disabled:opacity-40 sm:self-auto"
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>

                        {errors.lines && (
                            <span
                                role="alert"
                                className="text-[13px] text-danger"
                            >
                                {errors.lines.message ??
                                    "Add at least one valid item with qty ≥ 1."}
                            </span>
                        )}

                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => append({ itemId: 0, qty: 1 })}
                            className="w-full border-dashed border-border-strong text-foreground hover:border-brand-500 hover:bg-brand-50 hover:text-brand-800"
                        >
                            <Plus className="size-4" />
                            Add item
                        </Button>
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                        <Button
                            type="submit"
                            size="lg"
                            disabled={
                                createVisit.isPending ||
                                offline ||
                                itemsUnavailable
                            }
                            className="w-full"
                        >
                            {createVisit.isPending
                                ? "Registering…"
                                : "Register vehicle"}
                        </Button>

                        {offline && (
                            <Alert variant="danger">
                                You are offline. Registration needs a
                                connection.
                            </Alert>
                        )}

                        {!itemsLoading &&
                            !itemsFailed &&
                            items.length === 0 && (
                                <Alert variant="warning">
                                    No items are available — ask an admin to
                                    create one before registering.
                                </Alert>
                            )}
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
