"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type { Address, ApiResponse } from "../../../shared/contracts";
import { Button } from "@/components/ui/button";
import { addressSchema, type AddressInput } from "@/lib/orders/address-schema";
import { INDIAN_STATES } from "@/lib/orders/states";

type AddressFields = z.input<typeof addressSchema>;

/** Adds a delivery address without leaving checkout. */
export function AddressForm({
  onSaved,
  onCancel,
}: {
  onSaved: (address: Address) => void;
  onCancel?: () => void;
}) {
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AddressFields, unknown, AddressInput>({
    resolver: zodResolver(addressSchema),
    mode: "onBlur",
    defaultValues: { label: "", line1: "", line2: "", city: "", pincode: "" },
  });

  const submit = async (values: AddressInput) => {
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = (await response.json()) as ApiResponse<Address>;
      if (result.success) {
        onSaved(result.data);
        return;
      }
      for (const [field, messages] of Object.entries(
        result.error?.fields ?? {},
      ))
        setError(field as keyof AddressFields, { message: messages[0] });
      setFormError(
        result.error?.message ??
          "The address could not be saved. Please retry.",
      );
    } catch {
      setFormError("Network error. Check your connection and retry.");
    } finally {
      setSaving(false);
    }
  };

  const field = (
    name: keyof AddressFields,
    label: string,
    control: React.ReactNode,
  ) => (
    <div className="field">
      <label htmlFor={`addr-${name}`}>{label}</label>
      {control}
      {errors[name] && (
        <p className="field-error" id={`addr-${name}-error`}>
          {errors[name]?.message}
        </p>
      )}
    </div>
  );
  const describe = (name: keyof AddressFields) => ({
    id: `addr-${name}`,
    className: "plain-input",
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `addr-${name}-error` : undefined,
  });

  return (
    <form
      className="address-form"
      onSubmit={handleSubmit(submit)}
      noValidate
      aria-label="Add a delivery address"
    >
      <fieldset disabled={saving}>
        <legend>New delivery address</legend>
        <div className="address-grid">
          {field(
            "label",
            "Label",
            <input {...describe("label")} {...register("label")} />,
          )}
          {field(
            "line1",
            "Address line 1",
            <input
              autoComplete="address-line1"
              {...describe("line1")}
              {...register("line1")}
            />,
          )}
          {field(
            "line2",
            "Address line 2 (optional)",
            <input
              autoComplete="address-line2"
              {...describe("line2")}
              {...register("line2")}
            />,
          )}
          {field(
            "city",
            "City",
            <input
              autoComplete="address-level2"
              {...describe("city")}
              {...register("city")}
            />,
          )}
          {field(
            "state",
            "State or union territory",
            <select
              defaultValue=""
              {...describe("state")}
              {...register("state")}
            >
              <option value="">Choose state</option>
              {INDIAN_STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>,
          )}
          {field(
            "pincode",
            "Pincode",
            <input
              inputMode="numeric"
              maxLength={6}
              autoComplete="postal-code"
              {...describe("pincode")}
              {...register("pincode")}
            />,
          )}
        </div>
      </fieldset>
      {formError && (
        <p className="field-error" role="alert">
          {formError}
        </p>
      )}
      <div className="button-row">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save address"}
        </Button>
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
