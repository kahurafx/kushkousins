"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { swatch } from "@repo/ui";
import type { ShopFilters } from "@/lib/shop-params";

type Props = {
  category: string;
  categories: { slug: string; name: string }[];
  sizes: string[];
  colors: string[];
  showType: boolean;
  filters: ShopFilters;
  count: number;
};

const pill =
  "border border-forest/25 px-3 py-1.5 text-label uppercase transition-[transform,background-color] duration-100 active:scale-[0.97] aria-pressed:border-forest aria-pressed:bg-forest aria-pressed:text-canvas aria-[current=page]:border-forest aria-[current=page]:bg-forest aria-[current=page]:text-canvas";

export function ShopFilterBar({ category, categories, sizes, colors, showType, filters, count }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = (mutate: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  const toggle = (key: "size" | "color", value: string) =>
    update((p) => {
      const cur = new Set(p.get(key)?.split(",").filter(Boolean));
      if (cur.has(value)) cur.delete(value);
      else cur.add(value);
      if (cur.size) p.set(key, [...cur].join(","));
      else p.delete(key);
    });
  const setOne = (key: string, value?: string) => update((p) => (value ? p.set(key, value) : p.delete(key)));

  const tabs = [
    { slug: "all", name: "All" },
    { slug: "new", name: "New" },
    { slug: "upcycled", name: "Upcycled" },
    ...categories,
  ];
  const active = Boolean(filters.type || filters.size?.length || filters.color?.length || filters.min || filters.max || filters.q);

  return (
    <div className="mt-8 space-y-5 border-y border-forest/10 py-5">
      <nav aria-label="Categories" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex w-max gap-2">
          {tabs.map((t) => (
            <li key={t.slug}>
              <Link href={`/shop/${t.slug}`} aria-current={t.slug === category ? "page" : undefined} className={`block ${pill}`}>
                {t.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex flex-wrap items-start gap-x-8 gap-y-5">
        {showType && (
          <fieldset>
            <legend className="mb-2 text-label uppercase opacity-60">Type</legend>
            <div className="flex gap-2">
              {(["new", "upcycled"] as const).map((t) => (
                <button key={t} type="button" aria-pressed={filters.type === t} onClick={() => setOne("type", filters.type === t ? undefined : t)} className={pill}>
                  {t === "new" ? "New" : "Upcycled"}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset>
          <legend className="mb-2 text-label uppercase opacity-60">Size</legend>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => (
              <button key={s} type="button" aria-pressed={filters.size?.includes(s) ?? false} onClick={() => toggle("size", s)} className={pill}>
                {s}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-label uppercase opacity-60">Colour</legend>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={filters.color?.includes(c) ?? false}
                onClick={() => toggle("color", c)}
                className={`${pill} flex items-center gap-2`}
              >
                <span aria-hidden className="size-3 rounded-full border border-forest/30" style={{ background: swatch(c) }} />
                {c}
              </button>
            ))}
          </div>
        </fieldset>

        <form
          key={`${filters.min ?? ""}-${filters.max ?? ""}`}
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            update((p) => {
              for (const k of ["min", "max"]) {
                const v = String(f.get(k) ?? "").replace(/\D/g, "");
                if (v) p.set(k, v);
                else p.delete(k);
              }
            });
          }}
        >
          <fieldset>
            <legend className="mb-2 text-label uppercase opacity-60">Price (KES)</legend>
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="price-min">Minimum price</label>
              <input id="price-min" name="min" inputMode="numeric" placeholder="Min" defaultValue={filters.min ?? ""} className="w-20 border border-forest/25 bg-transparent px-2 py-1.5 text-body-sm" />
              <span aria-hidden>–</span>
              <label className="sr-only" htmlFor="price-max">Maximum price</label>
              <input id="price-max" name="max" inputMode="numeric" placeholder="Max" defaultValue={filters.max ?? ""} className="w-20 border border-forest/25 bg-transparent px-2 py-1.5 text-body-sm" />
              <button type="submit" className={pill}>Apply</button>
            </div>
          </fieldset>
        </form>

        <div className="ml-auto">
          <label htmlFor="sort" className="mb-2 block text-label uppercase opacity-60">Sort</label>
          <select
            id="sort"
            value={filters.sort ?? "newest"}
            onChange={(e) => setOne("sort", e.target.value === "newest" ? undefined : e.target.value)}
            className="border border-forest/25 bg-transparent px-2 py-1.5 text-body-sm"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </div>
      </div>

      <p className="flex items-center gap-4 text-body-sm" aria-live="polite">
        <span>{pending ? "Updating…" : `${count} ${count === 1 ? "piece" : "pieces"}`}</span>
        {active && (
          <button type="button" onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))} className="text-label uppercase underline underline-offset-4">
            Clear filters
          </button>
        )}
      </p>
    </div>
  );
}
