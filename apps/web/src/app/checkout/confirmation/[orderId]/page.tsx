import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";
import { formatKES } from "@repo/ui";
import { sessionCaller } from "@/lib/trpc-server";

export const metadata: Metadata = { title: "Order confirmed · kushkousins" };

export default async function ConfirmationPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const trpc = await sessionCaller();
  const order = await trpc.order.byId({ orderId }).catch((e) => {
    if (e instanceof TRPCError && (e.code === "NOT_FOUND" || e.code === "BAD_REQUEST")) notFound();
    throw e;
  });

  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-label uppercase">{order.status === "paid" ? "Payment received" : "Order reserved"}</p>
      <h1 className="mt-4 text-display-lg">Thank you</h1>
      <p className="mt-4 text-body">
        Order <span className="font-medium">#{order.id.slice(0, 8).toUpperCase()}</span>
        {order.status === "paid" ? " is confirmed. We'll let you know when it ships." : " is waiting for payment."}
      </p>
      <ul className="mt-10 divide-y divide-forest/10 border-y border-forest/10 text-left">
        {order.items.map((i) => (
          <li key={i.id} className="flex justify-between gap-4 py-4">
            <span>
              <span className="font-display text-display-sm">{i.productName}</span>
              <span className="block text-body-sm opacity-70">{i.size} · {i.color} · Qty {i.quantity}</span>
            </span>
            <span className="text-price tabular-nums">{formatKES(i.unitPriceCents * i.quantity)}</span>
          </li>
        ))}
      </ul>
      <dl className="ml-auto mt-4 max-w-xs space-y-1 text-body-sm tabular-nums">
        <div className="flex justify-between"><dt>Shipping</dt><dd>{order.shippingCents === 0 ? "Free" : formatKES(order.shippingCents)}</dd></div>
        <div className="flex justify-between text-price"><dt>Total</dt><dd>{formatKES(order.totalCents)}</dd></div>
      </dl>
      <div className="mt-12 flex justify-center gap-6">
        <Link href="/account" className="text-label uppercase underline underline-offset-4">View your orders</Link>
        <Link href="/shop/all" className="text-label uppercase underline underline-offset-4">Keep shopping</Link>
      </div>
    </div>
  );
}
