import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { orderStatus, OrderStatusSchema } from "@repo/types";
import { formatKES } from "@repo/ui";
import { fmtDateTime, orderRef, statusLabel } from "@/lib/admin-format";
import { requireAdmin } from "@/lib/session";
import { sessionCaller } from "@/lib/trpc-server";

export const metadata: Metadata = { title: "Orders · Admin" };

const PAGE = 50;
const Params = z.object({
  status: OrderStatusSchema.optional().catch(undefined),
  q: z.string().trim().max(80).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).default(1).catch(1),
});

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin("/admin/orders");
  const f = Params.parse(await searchParams);
  const rows = await (await sessionCaller()).admin.orders.list({ status: f.status, q: f.q || undefined, limit: PAGE + 1, offset: (f.page - 1) * PAGE });
  const hasMore = rows.length > PAGE;
  const href = (patch: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ status: f.status, q: f.q, ...patch })) {
      if (v === undefined || v === "" || (k === "page" && String(v) === "1")) continue;
      p.set(k, String(v));
    }
    const qs = p.toString();
    return qs ? `/admin/orders?${qs}` : "/admin/orders";
  };

  return (
    <div>
      <h1 className="text-display-md">Orders</h1>

      <nav aria-label="Filter by status" className="mt-6 overflow-x-auto">
        <ul className="flex w-max gap-2">
          {[undefined, ...orderStatus].map((s) => (
            <li key={s ?? "all"}>
              <Link
                href={href({ status: s, page: 1 })}
                aria-current={f.status === s ? "page" : undefined}
                className="block border border-forest/25 px-3 py-1.5 text-label uppercase aria-[current=page]:border-forest aria-[current=page]:bg-forest aria-[current=page]:text-canvas"
              >
                {s ? statusLabel[s] : "All"}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <form className="mt-4 flex gap-2" role="search">
        {f.status && <input type="hidden" name="status" value={f.status} />}
        <label htmlFor="order-q" className="sr-only">Search orders</label>
        <input id="order-q" name="q" defaultValue={f.q} placeholder="Email, name, #ref or M-Pesa receipt" className="w-full max-w-sm border border-forest/25 bg-transparent px-2 py-1.5 text-body-sm" />
        <button type="submit" className="border border-forest px-3 py-1.5 text-label uppercase">Search</button>
      </form>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[46rem] text-body-sm">
          <thead>
            <tr className="border-b border-forest/20 text-left text-label uppercase opacity-70">
              <th scope="col" className="py-2 font-medium">Order</th>
              <th scope="col" className="py-2 font-medium">Customer</th>
              <th scope="col" className="py-2 font-medium">Status</th>
              <th scope="col" className="py-2 font-medium">M-Pesa</th>
              <th scope="col" className="py-2 text-right font-medium">Items</th>
              <th scope="col" className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, PAGE).map((o) => (
              <tr key={o.id} className="border-b border-forest/10 hover:bg-stone/50">
                <td className="py-2.5">
                  <Link href={`/admin/orders/${o.id}`} className="font-medium tabular-nums hover:underline">{orderRef(o.id)}</Link>
                  <span className="block text-[0.75rem] opacity-60">{fmtDateTime(o.createdAt)}</span>
                </td>
                <td className="py-2.5">
                  {o.customerName}
                  <span className="block text-[0.75rem] opacity-60">{o.customerEmail}</span>
                </td>
                <td className="py-2.5">
                  <span className={o.status === "pending_payment" ? "bg-tangerine px-1.5 py-0.5 text-forest" : ""}>{statusLabel[o.status]}</span>
                </td>
                <td className="py-2.5 font-mono text-[0.75rem]">{o.mpesaReceiptNumber ?? "-"}</td>
                <td className="py-2.5 text-right tabular-nums">{o.itemCount}</td>
                <td className="py-2.5 text-right tabular-nums">{formatKES(o.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="py-12 text-center text-body-sm opacity-70">No orders match.</p>}
      </div>

      {(f.page > 1 || hasMore) && (
        <nav aria-label="Pagination" className="mt-6 flex gap-6">
          {f.page > 1 && <Link href={href({ page: f.page - 1 })} className="text-label uppercase underline underline-offset-4">Previous</Link>}
          {hasMore && <Link href={href({ page: f.page + 1 })} className="text-label uppercase underline underline-offset-4">Next</Link>}
        </nav>
      )}
    </div>
  );
}
