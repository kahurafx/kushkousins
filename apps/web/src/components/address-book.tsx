"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { RouterOutputs } from "@repo/api";
import { useTRPC } from "@/lib/trpc";
import { AddressForm } from "./address-form";

type Address = RouterOutputs["address"]["list"][number];
const link = "text-label uppercase underline underline-offset-4 disabled:opacity-50";
const clean = (a: Address) => ({
  label: a.label ?? undefined,
  recipientName: a.recipientName,
  phone: a.phone,
  line1: a.line1,
  line2: a.line2 ?? undefined,
  city: a.city,
  county: a.county,
  postalCode: a.postalCode ?? undefined,
});

export function AddressBook({ addresses }: { addresses: Address[] }) {
  const trpc = useTRPC();
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(addresses.length ? null : "new");
  const done = { onSuccess: () => (setEditing(null), router.refresh()) };
  const create = useMutation(trpc.address.create.mutationOptions(done));
  const update = useMutation(trpc.address.update.mutationOptions(done));
  const setDefault = useMutation(trpc.address.setDefault.mutationOptions({ onSuccess: () => router.refresh() }));
  const remove = useMutation(trpc.address.remove.mutationOptions({ onSuccess: () => router.refresh() }));

  return (
    <div className="space-y-6">
      <ul className="grid gap-4 md:grid-cols-2">
        {addresses.map((a) =>
          editing === a.id ? (
            <li key={a.id} className="border border-forest p-6 md:col-span-2">
              <AddressForm initial={clean(a)} submitLabel="Save address" pending={update.isPending} onSubmit={(v) => update.mutate({ ...v, id: a.id })} />
              <button type="button" className={`mt-4 ${link}`} onClick={() => setEditing(null)}>Cancel</button>
            </li>
          ) : (
            <li key={a.id} className="border border-forest/15 p-6">
              <p className="flex items-center gap-3 font-medium">
                {a.label ?? a.recipientName}
                {a.isDefault && <span className="bg-forest px-2 py-0.5 text-label uppercase text-canvas">Default</span>}
              </p>
              <p className="mt-2 text-body-sm">
                {a.recipientName} · {a.phone}
                <br />
                {a.line1}{a.line2 ? `, ${a.line2}` : ""}
                <br />
                {a.city}, {a.county}{a.postalCode ? ` ${a.postalCode}` : ""}
              </p>
              <div className="mt-4 flex flex-wrap gap-4">
                <button type="button" className={link} onClick={() => setEditing(a.id)}>Edit</button>
                {!a.isDefault && (
                  <button type="button" className={link} disabled={setDefault.isPending} onClick={() => setDefault.mutate({ id: a.id })}>
                    Make default
                  </button>
                )}
                <button type="button" className={link} disabled={remove.isPending} onClick={() => remove.mutate({ id: a.id })}>
                  Remove
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
      {editing === "new" ? (
        <div className="border border-forest p-6">
          <h2 className="mb-6 text-display-sm">New address</h2>
          <AddressForm
            submitLabel="Save address"
            pending={create.isPending}
            extra={
              <label className="flex items-center gap-2 text-body-sm">
                <input type="checkbox" name="isDefault" /> Make this my default
              </label>
            }
            onSubmit={(v, form) => create.mutate({ ...v, isDefault: form.get("isDefault") === "on" })}
          />
        </div>
      ) : (
        <button type="button" className={link} onClick={() => setEditing("new")}>Add an address</button>
      )}
    </div>
  );
}
