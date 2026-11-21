import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { InventoryModeSchema, ProductStatusSchema, salePriceCents } from "@repo/types";
import { formatKES } from "@repo/ui";
import { requireAdmin } from "@/lib/session";
import { sessionCaller } from "@/lib/trpc-server";

export const metadata: Metadata = { title: "Inventory · Admin" };

const Params = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  mode: InventoryModeSchema.optional().catch(undefined),
  status: ProductStatusSchema.optional().catch(undefined),
});
const input = "border border-forest/25 bg-transparent px-2 py-1.5 text-body-sm";

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin("/admin/inventory");
  const f = Params.parse(await searchParams);
  const products = await (await sessionCaller()).admin.products.list({ q: f.q || undefined, mode: f.mode, status: f.status });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-display-md">Inventory</h1>
        <Link href="/admin/inventory/new" className="bg-forest px-4 py-2.5 text-label uppercase text-canvas transition-transform duration-100 active:scale-[0.97]">
          New product
        </Link>
      </div>

      <form className="mt-6 flex flex-wrap items-end gap-3" role="search">
        <label className="text-label uppercase">
          <span className="block opacity-60">Search</span>
          <input name="q" defaultValue={f.q} placeholder="Name or slug" className={`mt-1 ${input}`} />
        </label>
        <label className="text-label uppercase">
          <span className="block opacity-60">Type</span>
          <select name="mode" defaultValue={f.mode ?? ""} className={`mt-1 ${input}`}>
            <option value="">All</option>
            <option value="NEW">New</option>
            <option value="UPCYCLED">Upcycled</option>
          </select>
        </label>
        <label className="text-label uppercase">
          <span className="block opacity-60">Status</span>
          <select name="status" defaultValue={f.status ?? ""} className={`mt-1 ${input}`}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="sold">Sold</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <button type="submit" className="border border-forest px-3 py-1.5 text-label uppercase">Apply</button>
        {(f.q || f.mode || f.status) && <Link href="/admin/inventory" className="text-label uppercase underline underline-offset-4">Clear</Link>}
      </form>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[44rem] text-body-sm">
          <thead>
            <tr className="border-b border-forest/20 text-left text-label uppercase opacity-70">
              <th scope="col" className="py-2 font-medium">Product</th>
              <th scope="col" className="py-2 font-medium">Type</th>
              <th scope="col" className="py-2 font-medium">Status</th>
              <th scope="col" className="py-2 text-right font-medium">Price</th>
              <th scope="col" className="py-2 text-right font-medium">Stock</th>
              <th scope="col" className="py-2 text-right font-medium">Variants</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const total = p.variants.reduce((n, v) => n + v.stock, 0);
              return (
                <tr key={p.id} className="border-b border-forest/10 hover:bg-stone/50">
                  <td className="py-2.5">
                    <Link href={`/admin/inventory/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                    <span className="block text-[0.75rem] opacity-60">{p.category?.name ?? "No category"} · /{p.slug}</span>
                  </td>
                  <td className="py-2.5">{p.mode === "UPCYCLED" ? "1-of-1" : "New"}</td>
                  <td className="py-2.5 capitalize">{p.status === "active" && total === 0 ? (p.mode === "UPCYCLED" ? "Reserved" : "Sold out") : p.status}</td>
                  <td className="py-2.5 text-right tabular-nums">
                    {formatKES(salePriceCents(p))}
                    {p.discountPercent ? <span className="block text-[0.75rem] opacity-60">−{p.discountPercent}%</span> : null}
                  </td>
                  <td className={`py-2.5 text-right tabular-nums ${p.mode === "NEW" && total <= 2 && p.status === "active" ? "font-medium text-espresso" : ""}`}>{total}</td>
                  <td className="py-2.5 text-right tabular-nums">{p.variants.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {products.length === 0 && <p className="py-12 text-center text-body-sm opacity-70">No products match.</p>}
      </div>
    </div>
  );
}
