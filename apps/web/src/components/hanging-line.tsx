"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { hangingLine, partingOffset, spring } from "@repo/ui";
import type { ShowcaseItem } from "@/lib/showcase";
import { GarmentArt } from "./garment-art";
import { Price } from "./price";

const transition = { type: "spring", ...spring.default } as const;

/**
 * The Hanging Line hero. Each <li> slot keeps a fixed layout box (hover target never moves);
 * only its inner layer animates, so a neighbour sliding under the cursor can't steal hover.
 */
export function HangingLine({ items }: { items: ShowcaseItem[] }) {
  const [active, setActive] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const rackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setActive(null);
    const onDown = (e: PointerEvent) => {
      if (!rackRef.current?.contains(e.target as Node)) setActive(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [active]);

  return (
    <section aria-label="The Hanging Line" className="w-full">
      <div
        ref={rackRef}
        // Clear only when the mouse leaves the whole rack, so crossing gaps never flickers the card.
        onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)}
        onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setActive(null)}
        className="overflow-x-auto overscroll-x-contain [scrollbar-width:none]"
      >
        {/* pt/pb reserve room for the scale-up and the card overhang: overflow-x clips the y axis too */}
        <ul className="relative mx-auto flex w-max gap-4 px-8 pt-10 pb-32 sm:gap-6 md:px-16">
          <li aria-hidden className="pointer-events-none absolute inset-x-0 top-10 h-px bg-forest/70" />
          {items.map((item, i) => {
            const isActive = active === i;
            return (
              <li
                key={item.id}
                className="relative w-32 shrink-0 sm:w-36 lg:w-40"
                style={{ zIndex: isActive ? 20 : 1 }}
                onPointerEnter={(e) => e.pointerType === "mouse" && setActive(i)}
                onFocus={() => setActive(i)}
              >
                <motion.div
                  animate={
                    reduce
                      ? { x: 0, scale: 1 }
                      : { x: partingOffset(i, active), scale: isActive ? hangingLine.activeScale : 1 }
                  }
                  transition={transition}
                  style={{ transformOrigin: "50% 0%" }}
                >
                  <button
                    type="button"
                    aria-expanded={isActive}
                    aria-controls={`hl-card-${item.id}`}
                    aria-label={`${item.name}, ${item.mode === "UPCYCLED" ? "one of a kind" : "new"}`}
                    // Click selects (never toggles): a tap fires pointerenter→click, toggling would close it.
                    onClick={() => setActive(i)}
                    className="block w-full -translate-y-[0.6rem] cursor-pointer outline-offset-4 outline-forest focus-visible:outline-2"
                  >
                    <GarmentArt item={item} hanger className="h-auto w-full" />
                  </button>
                </motion.div>

                {/* Card floats over the garment's hem, anchored to its slot */}
                <AnimatePresence>
                  {isActive && (
                    <div className="absolute inset-x-[-3rem] top-[72%] flex justify-center">
                      <motion.div
                        id={`hl-card-${item.id}`}
                        initial={{ opacity: 0, y: reduce ? 0 : -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: reduce ? 0 : -8 }}
                        transition={reduce ? { duration: 0.15 } : transition}
                        style={{ transformOrigin: "50% 0%" }}
                        className="w-60 bg-canvas/90 p-5 shadow-[0_12px_40px_-12px_rgb(28_43_33/0.35)] backdrop-blur-md chamfer-sm"
                      >
                        <p className="text-label uppercase">
                          <span className={item.mode === "UPCYCLED" ? "bg-tangerine px-1.5 py-0.5 text-forest" : ""}>
                            {item.sold ? "Sold" : item.mode === "UPCYCLED" ? "One-of-a-kind" : "New"}
                          </span>
                        </p>
                        <h3 className="mt-3 text-display-sm">{item.name}</h3>
                        <Price item={item} className="mt-1" />
                        <Link
                          href={`/product/${item.slug}`}
                          className="mt-4 inline-block border-b border-forest pb-0.5 text-label uppercase outline-offset-4 outline-forest focus-visible:outline-2"
                        >
                          View Details
                        </Link>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
