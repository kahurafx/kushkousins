"use client";

import { useState } from "react";
import { AddressSchema, type AddressInput } from "@repo/types";

const field = "mt-1 block w-full border border-forest/25 bg-transparent px-3 py-2.5 text-body aria-invalid:border-espresso";

const fields: { name: keyof AddressInput; label: string; autoComplete: string; optional?: boolean; type?: string }[] = [
  { name: "recipientName", label: "Full name", autoComplete: "name" },
  { name: "phone", label: "Phone", autoComplete: "tel", type: "tel" },
  { name: "line1", label: "Street address", autoComplete: "address-line1" },
  { name: "line2", label: "Apartment, building (optional)", autoComplete: "address-line2", optional: true },
  { name: "city", label: "Town / city", autoComplete: "address-level2" },
  { name: "county", label: "County", autoComplete: "address-level1" },
  { name: "postalCode", label: "Postal code (optional)", autoComplete: "postal-code", optional: true },
  { name: "label", label: "Label, e.g. Home (optional)", autoComplete: "off", optional: true },
];

type Props = {
  initial?: Partial<AddressInput>;
  submitLabel: string;
  pending?: boolean;
  extra?: React.ReactNode; // e.g. "save to my addresses" checkbox
  onSubmit: (values: AddressInput, form: FormData) => void;
};

/** Validates with the same AddressSchema the API uses, field by field. */
export function AddressForm({ initial, submitLabel, pending, extra, onSubmit }: Props) {
  const [errors, setErrors] = useState<Partial<Record<keyof AddressInput, string>>>({});

  return (
    <form
      noValidate
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const raw = Object.fromEntries(fields.map((f) => [f.name, String(form.get(f.name) ?? "").trim() || undefined]));
        const parsed = AddressSchema.safeParse(raw);
        if (!parsed.success) {
          const next: typeof errors = {};
          for (const issue of parsed.error.issues) next[issue.path[0] as keyof AddressInput] ??= issue.message;
          setErrors(next);
          e.currentTarget.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
          return;
        }
        setErrors({});
        onSubmit(parsed.data, form);
      }}
    >
      {fields.map((f) => (
        <label key={f.name} className={`block text-label uppercase ${f.name === "line1" || f.name === "line2" ? "sm:col-span-2" : ""}`}>
          {f.label}
          <input
            name={f.name}
            type={f.type ?? "text"}
            autoComplete={f.autoComplete}
            defaultValue={initial?.[f.name] ?? ""}
            required={!f.optional}
            aria-invalid={errors[f.name] ? true : undefined}
            aria-describedby={errors[f.name] ? `${f.name}-error` : undefined}
            className={field}
          />
          {errors[f.name] && (
            <span id={`${f.name}-error`} className="mt-1 block normal-case tracking-normal text-espresso">
              {f.name === "phone" ? errors[f.name] : "Please fill this in."}
            </span>
          )}
        </label>
      ))}
      {extra && <div className="sm:col-span-2">{extra}</div>}
      <button
        type="submit"
        disabled={pending}
        className="bg-forest py-4 text-label uppercase text-canvas transition-transform duration-100 active:scale-[0.97] disabled:opacity-50 sm:col-span-2"
      >
        {pending ? "One moment…" : submitLabel}
      </button>
    </form>
  );
}
