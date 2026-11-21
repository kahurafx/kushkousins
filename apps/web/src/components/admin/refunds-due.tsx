"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import type { RouterOutputs } from "@repo/api";
import { formatKES } from "@repo/ui";
import { fmtDateTime, orderRef } from "@/lib/admin-format";
import { useTRPC } from "@/lib/trpc";

type Refund = RouterOutputs["admin"]["orders"]["refunds"][number];

/** M-Pesa took money that couldn't pay its order. Refund in the M-Pesa portal, then clear it here. */
export function RefundsDue({ refunds }: { refunds: Refund[] }) {
  const trpc = useTRPC();
  const router = useRouter();
  const done = useMutation(trpc.admin.orders.markRefunded.mutationOptions({ onSuccess: () => router.refresh() }));
  return (
    <section role="region" aria-labelledby="refunds-title" className="border-2 border-espresso p-5">
      <h2 id="refunds-title" className="text-label uppercase">Refunds due · {refunds.length}</h2>
      <p className="mt-1 text-body-sm opacity-80">
        These customers paid by M-Pesa, but the payment couldn&apos;t complete their order: their reservation was released first, they paid twice, the amount didn&apos;t match, or M-Pesa reported a payment we have no record of. Refund each one through the M-Pesa business portal, then mark it refunded.
      </p>
      <ul className="mt-3 divide-y divide-forest/10">
        {refunds.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-body-sm">
            <span>
              {r.orderId ? (
                <Link href={`/admin/orders/${r.orderId}`} className="font-medium tabular-nums underline underline-offset-4">{orderRef(r.orderId)}</Link>
              ) : (
                <span className="font-medium">No matching order</span>
              )}{" "}
              {r.customerName ?? "Unknown customer"} · {r.phone} · <span className="font-mono">{r.receipt ?? "no receipt yet"}</span> · {fmtDateTime(r.createdAt)}
            </span>
            <span className="flex items-center gap-3">
              <span className="tabular-nums">{formatKES(r.amountCents)}</span>
              <button
                type="button"
                disabled={done.isPending}
                onClick={() => done.mutate({ paymentId: r.id })}
                className="border border-forest/30 px-2 py-1 text-label uppercase transition-transform duration-100 active:scale-[0.97] disabled:opacity-40"
              >
                Mark refunded
              </button>
            </span>
          </li>
        ))}
      </ul>
      {done.error && <p role="alert" className="mt-2 text-body-sm text-espresso">{done.error.message}</p>}
    </section>
  );
}
