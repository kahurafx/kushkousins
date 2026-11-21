"use client";

import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ShowcaseItem } from "@/lib/showcase";
import { ProductCard } from "./product-card";

type Entry = { item: ShowcaseItem; category: string | null };
const filters = [
  { id: "all", label: "All" },
  { id: "upcycled", label: "Upcycled" },
  { id: "streetwear", label: "Streetwear" },
  { id: "formal", label: "Formal" },
  { id: "outerwear", label: "Outerwear" },
] as const;
type Filter = (typeof filters)[number]["id"];

const pill =
  "border border-forest/25 px-3 py-1.5 text-label uppercase transition-[transform,background-color] duration-100 active:scale-[0.97] aria-pressed:border-forest aria-pressed:bg-forest aria-pressed:text-canvas";
const arrow =
  "grid size-11 place-items-center rounded-full border border-forest transition-transform duration-100 active:scale-[0.97] disabled:opacity-30";

export function FanFavorites({ entries }: { entries: Entry[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [progress, setProgress] = useState({ start: true, end: false, ratio: 0 });
  const scroller = useRef<HTMLUListElement>(null);
  const reduce = useReducedMotion();

  const shown = entries.filter(
    (e) => filter === "all" || (filter === "upcycled" ? e.item.mode === "UPCYCLED" : e.category === filter),
  );

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setProgress({ start: el.scrollLeft <= 2, end: el.scrollLeft >= max - 2, ratio: max > 0 ? el.scrollLeft / max : 1 });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ left: 0 });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [filter, measure]);

  const page = (dir: 1 | -1) => {
    const el = scroller.current;
    const card = el?.querySelector("li");
    if (!el || !card) return;
    const step = card.getBoundingClientRect().width + 24; // card + gap
    el.scrollBy({ left: dir * step * Math.max(1, Math.floor(el.clientWidth / step)), behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <section aria-labelledby="fan-favorites" className="mx-auto w-full max-w-7xl px-4 pb-24 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <h2 id="fan-favorites" className="text-display-lg">Fan Favorites</h2>
          <p className="mt-2 text-body-sm opacity-70">Fast movers and pieces on offer.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className={arrow} onClick={() => page(-1)} disabled={progress.start} aria-controls="fan-favorites-list">
            <span className="sr-only">Previous</span>
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6}><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <button type="button" className={arrow} onClick={() => page(1)} disabled={progress.end} aria-controls="fan-favorites-list">
            <span className="sr-only">Next</span>
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6}><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      <div role="group" aria-label="Filter fan favorites" className="mt-8 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)} className={pill}>
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="py-16 text-body-sm">No favourites in this category right now.</p>
      ) : (
        <ul
          id="fan-favorites-list"
          ref={scroller}
          onScroll={measure}
          className="-mx-4 mt-8 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] md:-mx-8 md:scroll-px-8 md:px-8"
        >
          {shown.map(({ item }, i) => (
            <li key={item.id} className="w-64 shrink-0 snap-start md:w-72">
              {/* shortcut: "featured" = first favourite until a curation flag exists (Phase 4) */}
              <ProductCard item={item} featured={i === 0 && filter === "all"} />
            </li>
          ))}
        </ul>
      )}

      <div aria-hidden className="mt-6 h-px w-full bg-forest/15">
        <div
          className="h-px origin-left bg-forest transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `scaleX(${Math.max(0.08, progress.ratio)})` }}
        />
      </div>
    </section>
  );
}
