import type { Metadata } from "next";
import Link from "next/link";
import { formatKES } from "@repo/ui";
import { CancelOrderButton } from "@/components/account-client";
import { requireSession } from "@/lib/session";
import { sessionCaller } from "@/lib/trpc-server";

export const metadata: Metadata = { title: "Your orders · kushkousins" };

const statusLabel: Record<string, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default async function OrdersPage() {
  await requireSession("/account");
  const orders = await (await sessionCaller()).order.mine();
  if (orders.length === 0) {
    return (
      <p className="text-body">
        No orders yet.{" "}
        <Link href="/shop/all" className="underline underline-offset-4">Discover the collection</Link>
      </p>
    );
  }
  return (
    <ul className="space-y-6">
      {orders.map((o) => (
        <li key={o.id} className="border border-forest/15 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <p className="font-display text-display-sm">#{o.id.slice(0, 8).toUpperCase()}</p>
            <p className="text-label uppercase">
              <span className={o.status === "pending_payment" ? "bg-tangerine px-2 py-1 text-forest" : ""}>{statusLabel[o.status]}</span>
            </p>
          </div>
          <p className="mt-1 text-body-sm opacity-70">
            {o.createdAt.toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })} ·{" "}
            {o.items.map((i) => `${i.productName} ×${i.quantity}`).join(", ")}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <p className="text-price tabular-nums">{formatKES(o.totalCents)}</p>
            <div className="flex gap-6">
              {o.status === "pending_payment" && <CancelOrderButton orderId={o.id} />}
              <Link href={`/checkout/confirmation/${o.id}`} className="text-label uppercase underline underline-offset-4">Details</Link>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
