import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";
import { formatKES } from "@repo/ui";
import { OrderActions } from "@/components/admin/order-actions";
import { fmtDateTime, orderRef, statusLabel } from "@/lib/admin-format";
import { requireAdmin } from "@/lib/session";
import { sessionCaller } from "@/lib/trpc-server";

export const metadata: Metadata = { title: "Order · Admin" };

const pipeline = ["pending_payment", "paid", "processing", "shipped", "delivered"] as const;

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin(`/admin/orders/${id}`);
  const order = await (await sessionCaller()).admin.orders.byId({ id }).catch((e) => {
    if (e instanceof TRPCError && (e.code === "NOT_FOUND" || e.code === "BAD_REQUEST")) notFound();
    throw e;
  });
  const reached = pipeline.indexOf(order.status as (typeof pipeline)[number]);
  const a = order.shippingAddress;

  return (
    <div>
      <Link href="/admin/orders" className="text-label uppercase underline underline-offset-4">All orders</Link>
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-sans text-display-sm font-medium tabular-nums">Order {orderRef(order.id)}</h1>
        <p className="text-body-sm opacity-70">Placed {fmtDateTime(order.createdAt)}</p>
      </div>

      {order.status === "cancelled" ? (
        <p className="mt-6 inline-block bg-stone px-3 py-1.5 text-label uppercase">Cancelled: stock released</p>
      ) : (
        <ol aria-label="Fulfilment progress" className="mt-6 grid grid-cols-5 gap-1">
          {pipeline.map((s, i) => (
            <li key={s} aria-current={i === reached ? "step" : undefined} className="text-[0.6875rem] uppercase tracking-wider">
              <span className={`block h-1 ${i <= reached ? "bg-forest" : "bg-forest/15"}`} />
              <span className={`mt-2 block ${i <= reached ? "" : "opacity-50"}`}>{statusLabel[s]}</span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-8">
          <section>
            <h2 className="text-label uppercase">Items</h2>
            <table className="mt-3 w-full text-body-sm">
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.id} className="border-b border-forest/10">
                    <td className="py-2.5">
                      {i.productId ? <Link href={`/admin/inventory/${i.productId}`} className="font-medium hover:underline">{i.productName}</Link> : <span className="font-medium">{i.productName}</span>}
                      <span className="block text-[0.75rem] opacity-60">{i.size} · {i.color} · {formatKES(i.unitPriceCents)} each</span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">×{i.quantity}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatKES(i.unitPriceCents * i.quantity)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="tabular-nums">
                <tr><td className="pt-3" colSpan={2}>Subtotal</td><td className="pt-3 text-right">{formatKES(order.subtotalCents)}</td></tr>
                <tr><td colSpan={2}>Shipping</td><td className="text-right">{order.shippingCents === 0 ? "Free" : formatKES(order.shippingCents)}</td></tr>
                <tr className="font-medium"><td className="pt-1" colSpan={2}>Total</td><td className="pt-1 text-right">{formatKES(order.totalCents)}</td></tr>
              </tfoot>
            </table>
          </section>

          <section>
            <h2 className="text-label uppercase">Actions</h2>
            <div className="mt-3">
              <OrderActions id={order.id} status={order.status} />
            </div>
          </section>
        </div>

        <aside className="space-y-6 text-body-sm">
          <section className="border border-forest/15 p-5">
            <h2 className="text-label uppercase">Customer</h2>
            <p className="mt-2 font-medium">{order.user.name}</p>
            <a href={`mailto:${order.user.email}`} className="underline underline-offset-4">{order.user.email}</a>
          </section>
          <section className="border border-forest/15 p-5">
            <h2 className="text-label uppercase">Deliver to</h2>
            <p className="mt-2">
              {a.recipientName} · <a href={`tel:${a.phone}`} className="underline underline-offset-4">{a.phone}</a>
              <br />
              {a.line1}{a.line2 ? `, ${a.line2}` : ""}
              <br />
              {a.city}, {a.county}{a.postalCode ? ` ${a.postalCode}` : ""}
            </p>
          </section>
          <section className="border border-forest/15 p-5">
            <h2 className="text-label uppercase">M-Pesa</h2>
            <dl className="mt-2 space-y-1">
              <div className="flex justify-between gap-4"><dt className="opacity-70">Receipt</dt><dd className="font-mono">{order.mpesaReceiptNumber ?? "-"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="opacity-70">Phone</dt><dd>{order.mpesaPhone ?? "-"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="opacity-70">Paid</dt><dd>{order.paidAt ? fmtDateTime(order.paidAt) : "Not yet"}</dd></div>
            </dl>
            {order.payments.length > 0 && (
              <>
                <h3 className="mt-4 text-label uppercase opacity-70">Prompts sent</h3>
                <ul className="mt-2 space-y-1.5 text-body-sm">
                  {order.payments.map((p) => (
                    <li key={p.id} className="flex justify-between gap-3">
                      <span>
                        {fmtDateTime(p.createdAt)} · {p.phone}
                        {p.resultDesc && p.status === "failed" && <span className="block opacity-70">{p.resultDesc}</span>}
                      </span>
                      <span className={`shrink-0 ${p.status === "succeeded" && !p.applied && !p.refundedAt ? "font-medium text-espresso" : ""}`}>
                        {p.status === "pending" ? "Waiting" : p.status === "failed" ? "Failed" : p.applied ? "Paid" : p.refundedAt ? "Refunded" : "Refund due"}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
