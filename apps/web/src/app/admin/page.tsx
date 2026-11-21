import type { Metadata } from "next";
import Link from "next/link";
import { orderStatus } from "@repo/types";
import { formatKES } from "@repo/ui";
import { ReleaseStale } from "@/components/admin/release-stale";
import { RevenueChart } from "@/components/admin/revenue-chart";
import { fmtDateTime, orderRef, statusLabel } from "@/lib/admin-format";
import { requireAdmin } from "@/lib/session";
import { sessionCaller } from "@/lib/trpc-server";

export const metadata: Metadata = { title: "Overview · Admin" };

function Stat({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="border border-forest/15 p-5">
      <p className="text-body-sm opacity-70">{label}</p>
      <p className="mt-2 text-display-sm font-medium tabular-nums">{value}</p>
      {children}
    </div>
  );
}

export default async function AdminOverview() {
  await requireAdmin("/admin");
  const o = await (await sessionCaller()).admin.overview();
  const pending = o.byStatus.pending_payment ?? 0;
  const compact = (n: number) => new Intl.NumberFormat("en-KE", { notation: n >= 10_000 ? "compact" : "standard" }).format(n);

  return (
    <div className="space-y-10">
      <h1 className="text-display-md">Overview</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Revenue, last 30 days" value={formatKES(o.revenue30Cents)} />
        <Stat label="Revenue, all time" value={formatKES(o.revenueCents)} />
        <Stat label="Paid orders" value={compact(o.paidOrders)} />
        <Stat label="Awaiting payment" value={compact(pending)}>
          {pending > 0 && <ReleaseStale />}
        </Stat>
        <Stat label="Customers" value={compact(o.customers)} />
        <Stat label="Active products" value={compact(o.activeProducts)} />
        <Stat label="1-of-1s sold" value={compact(o.soldPieces)} />
        <Stat label="To ship" value={compact((o.byStatus.paid ?? 0) + (o.byStatus.processing ?? 0))} />
      </div>

      <section className="border border-forest/15 p-5">
        <RevenueChart days={o.daily} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border border-forest/15 p-5">
          <h2 className="text-label uppercase">Recent orders</h2>
          {o.recent.length === 0 ? (
            <p className="mt-4 text-body-sm opacity-70">No orders yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-forest/10">
              {o.recent.map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/orders/${r.id}`} className="flex items-baseline justify-between gap-3 py-2.5 hover:bg-stone/60">
                    <span>
                      <span className="font-medium tabular-nums">{orderRef(r.id)}</span>{" "}
                      <span className="text-body-sm opacity-70">{r.customer} · {fmtDateTime(r.createdAt)}</span>
                    </span>
                    <span className="shrink-0 text-body-sm tabular-nums">{statusLabel[r.status]} · {formatKES(r.totalCents)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/orders" className="mt-4 inline-block text-label uppercase underline underline-offset-4">All orders</Link>
        </section>

        <section className="space-y-6">
          <div className="border border-forest/15 p-5">
            <h2 className="text-label uppercase">Orders by status</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-body-sm tabular-nums">
              {orderStatus.map((s) => (
                <div key={s} className="flex justify-between border-b border-forest/10 py-1.5">
                  <dt>
                    <Link href={`/admin/orders?status=${s}`} className="hover:underline">{statusLabel[s]}</Link>
                  </dt>
                  <dd>{o.byStatus[s] ?? 0}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="border border-forest/15 p-5">
            <h2 className="text-label uppercase">Low stock (New, ≤ 2 left)</h2>
            {o.lowStock.length === 0 ? (
              <p className="mt-3 text-body-sm opacity-70">Everything is well stocked.</p>
            ) : (
              <ul className="mt-3 space-y-1.5 text-body-sm">
                {o.lowStock.map((v) => (
                  <li key={`${v.productId}-${v.size}-${v.color}`} className="flex justify-between gap-3">
                    <Link href={`/admin/inventory/${v.productId}`} className="hover:underline">
                      {v.name} <span className="opacity-70">· {v.size} · {v.color}</span>
                    </Link>
                    <span className="tabular-nums">{v.stock === 0 ? "Out" : `${v.stock} left`}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
