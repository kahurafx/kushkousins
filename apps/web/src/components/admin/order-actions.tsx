"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { MpesaReceiptSchema, orderTransitions, type OrderStatus } from "@repo/types";
import { statusLabel } from "@/lib/admin-format";
import { useTRPC } from "@/lib/trpc";

const primary = "bg-forest px-4 py-2.5 text-label uppercase text-canvas transition-transform duration-100 active:scale-[0.97] disabled:opacity-50";
const secondary = "border border-forest px-4 py-2.5 text-label uppercase transition-transform duration-100 active:scale-[0.97] disabled:opacity-50";

/** Only the legal next moves (from the shared transition map) are offered. */
export function OrderActions({ id, status, phone }: { id: string; status: OrderStatus; phone: string | null }) {
  const trpc = useTRPC();
  const router = useRouter();
  const done = { onSuccess: () => router.refresh() };
  const setStatus = useMutation(trpc.admin.orders.setStatus.mutationOptions(done));
  const markPaid = useMutation(trpc.admin.orders.markPaid.mutationOptions(done));
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const next = orderTransitions[status].filter((s) => s !== "paid" && s !== "cancelled");
  const error = setStatus.error?.message ?? markPaid.error?.message;

  if (status === "delivered" || status === "cancelled") {
    return <p className="text-body-sm opacity-70">This order is {statusLabel[status].toLowerCase()}. No further actions.</p>;
  }

  return (
    <div className="space-y-5">
      {next.map((to) => (
        <button key={to} type="button" className={primary} disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id, from: status, to })}>
          Mark {statusLabel[to].toLowerCase()}
        </button>
      ))}

      {status === "pending_payment" && (
        <>
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const receipt = MpesaReceiptSchema.safeParse(String(f.get("receipt") ?? ""));
              if (!receipt.success) return setReceiptError(receipt.error.issues[0]!.message);
              setReceiptError(null);
              markPaid.mutate({ id, receipt: receipt.data, phone: phone ?? undefined });
            }}
          >
            <label className="block text-label uppercase">
              M-Pesa receipt number
              <input
                name="receipt"
                autoComplete="off"
                placeholder="QK4XYZ12AB"
                aria-invalid={receiptError ? true : undefined}
                aria-describedby={receiptError ? "receipt-err" : "receipt-hint"}
                className="mt-1 block w-full max-w-xs border border-forest/25 bg-transparent px-3 py-2 font-mono uppercase"
              />
              {receiptError ? (
                <span id="receipt-err" className="mt-1 block text-[0.75rem] normal-case tracking-normal text-espresso">{receiptError}</span>
              ) : (
                <span id="receipt-hint" className="mt-1 block text-[0.75rem] normal-case tracking-normal opacity-70">
                  For payments received outside checkout (till/paybill). Marks 1-of-1s sold.
                </span>
              )}
            </label>
            <button type="submit" className={primary} disabled={markPaid.isPending}>
              {markPaid.isPending ? "Recording…" : "Mark paid"}
            </button>
          </form>

          {confirmCancel ? (
            <div className="flex flex-wrap items-center gap-3 border border-espresso/40 p-3">
              <span className="text-body-sm">Cancel and release the reserved stock?</span>
              <button type="button" className={primary} disabled={setStatus.isPending} onClick={() => setStatus.mutate({ id, from: status, to: "cancelled" })}>
                Yes, cancel order
              </button>
              <button type="button" className={secondary} onClick={() => setConfirmCancel(false)}>Keep it</button>
            </div>
          ) : (
            <button type="button" className={secondary} onClick={() => setConfirmCancel(true)}>Cancel order</button>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="text-body-sm text-espresso">
          {error}
        </p>
      )}
    </div>
  );
}
