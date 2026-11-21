"use client";

import Link from "next/link";
import type { ShowcaseItem } from "@/lib/showcase";
import { GarmentArt } from "./garment-art";
import { Price } from "./price";

type Props = {
  item: ShowcaseItem;
  featured?: boolean;
  onQuickAdd?: (item: ShowcaseItem) => void;
};

/**
 * Signature chamfered card. The chamfer clips only the backdrop layer, so the focus ring
 * (drawn on the article) is never clipped. The link is stretched over the card; the
 * quick-add button is a sibling above it (never nested in the <a>).
 */
export function ProductCard({ item, featured = false, onQuickAdd }: Props) {
  const pills = [
    item.discountPercent ? `-${item.discountPercent}%` : null,
    item.mode === "UPCYCLED" ? "Upcycled" : null,
    item.sold ? "Sold" : null,
  ].filter(Boolean) as string[];

  return (
    <article className="group relative outline-offset-4 outline-forest has-[a:focus-visible]:outline-2">
      <div className="relative aspect-[3/4]">
        <div className="absolute inset-0 overflow-hidden bg-stone chamfer-md">
          <GarmentArt
            item={item}
            className="absolute inset-x-[14%] top-[12%] bottom-[10%] h-auto w-[72%] transition-transform duration-500 ease-[var(--ease-spring)] group-hover:scale-[1.03] motion-reduce:transition-none"
          />
          {item.sold && <div className="absolute inset-0 bg-stone/60" />}
        </div>

        {pills.length > 0 && (
          <ul className="absolute left-6 top-3 flex gap-1.5" aria-label="Status">
            {pills.map((p) => (
              <li
                key={p}
                className={`px-2 py-1 text-label uppercase ${p.startsWith("-") ? "bg-tangerine text-forest" : "bg-forest text-canvas"}`}
              >
                {p}
              </li>
            ))}
          </ul>
        )}

        {featured && (
          <span className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-tangerine text-forest" title="Editor's pick">
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden fill="currentColor">
              <path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.2l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z" />
            </svg>
            <span className="sr-only">Editor&apos;s pick</span>
          </span>
        )}

        <button
          type="button"
          disabled={item.sold}
          // shortcut: no-op until the Phase 3 cart passes onQuickAdd
          onClick={() => onQuickAdd?.(item)}
          aria-label={item.sold ? `${item.name} is sold` : `Add ${item.name} to bag`}
          className="absolute bottom-7 right-7 z-10 grid size-11 place-items-center rounded-full bg-forest text-canvas transition-transform duration-100 ease-out hover:bg-espresso active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:cursor-not-allowed disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 8h14l-1.2 12H6.2z" />
            <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
          </svg>
        </button>
      </div>

      <div className="mt-4">
        <h3 className="text-display-sm">
          <Link href={`/product/${item.slug}`} className="outline-none after:absolute after:inset-0">
            {item.name}
          </Link>
        </h3>
        <Price item={item} className="mt-1" />
      </div>
    </article>
  );
}
