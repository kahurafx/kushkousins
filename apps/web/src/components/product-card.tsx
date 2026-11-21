"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { bagDrawer, cart } from "@/lib/cart";
import { availabilityLabel, type ShowcaseItem } from "@/lib/showcase";
import { GarmentArt } from "./garment-art";
import { Price } from "./price";

type Props = { item: ShowcaseItem; featured?: boolean };

/**
 * Signature chamfered card. The chamfer clips only the backdrop layer, so the focus ring
 * (drawn on the article) is never clipped. The link is stretched over the card; the
 * quick-add button is a sibling above it (never nested in the <a>).
 */
export function ProductCard({ item, featured = false }: Props) {
  const [choosing, setChoosing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inStock = item.variants.filter((v) => v.stock > 0);
  const status = availabilityLabel(item);
  const unavailable = item.availability !== "in_stock";

  useEffect(() => {
    if (!choosing) return;
    menuRef.current?.querySelector("button")?.focus();
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !menuRef.current?.contains(e.target as Node)) setChoosing(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [choosing]);

  const add = (variantId: string) => {
    cart.add(variantId);
    setChoosing(false);
    bagDrawer.open();
  };

  const pills = [
    item.discountPercent ? `-${item.discountPercent}%` : null,
    item.mode === "UPCYCLED" ? "Upcycled" : null,
    status,
  ].filter(Boolean) as string[];

  return (
    <article className="group relative outline-offset-4 outline-forest has-[a:focus-visible]:outline-2">
      <div className="relative aspect-[3/4]">
        <div className="absolute inset-0 overflow-hidden bg-stone chamfer-md">
          <GarmentArt
            item={item}
            className="absolute inset-x-[14%] top-[12%] bottom-[10%] h-auto w-[72%] transition-transform duration-500 ease-[var(--ease-spring)] group-hover:scale-[1.03] motion-reduce:transition-none"
          />
          {unavailable && <div className="absolute inset-0 bg-stone/60" />}
        </div>

        {pills.length > 0 && (
          <ul className="absolute left-6 top-3 flex flex-wrap gap-1.5 pr-12" aria-label="Status">
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

        <div ref={menuRef} className="absolute bottom-7 right-7 z-10">
          {choosing && (
            <div
              role="menu"
              aria-label={`Choose a size for ${item.name}`}
              className="absolute bottom-full right-0 mb-2 w-40 bg-canvas p-1.5 shadow-[0_12px_40px_-12px_rgb(28_43_33/0.35)]"
            >
              {inStock.map((v) => (
                <button
                  key={v.id}
                  role="menuitem"
                  type="button"
                  onClick={() => add(v.id)}
                  className="block w-full px-3 py-2 text-left text-body-sm hover:bg-stone focus-visible:bg-stone focus-visible:outline-none"
                >
                  {v.size} · {v.color}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            disabled={unavailable}
            aria-haspopup={inStock.length > 1 ? "menu" : undefined}
            aria-expanded={inStock.length > 1 ? choosing : undefined}
            onClick={() => (inStock.length === 1 ? add(inStock[0]!.id) : setChoosing((c) => !c))}
            aria-label={unavailable ? `${item.name}: ${status}` : `Add ${item.name} to bag`}
            className="grid size-11 place-items-center rounded-full bg-forest text-canvas transition-transform duration-100 ease-out hover:bg-espresso active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest disabled:cursor-not-allowed disabled:opacity-40"
          >
            <BagIcon className="size-5" />
          </button>
        </div>
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

export function BagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 8h14l-1.2 12H6.2z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </svg>
  );
}
