"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { formatKES, silhouetteFor, spring } from "@repo/ui";
import { bagDrawer, cart, useBagDrawerOpen, useCart } from "@/lib/cart";
import { useTRPC } from "@/lib/trpc";
import { GarmentArt } from "./garment-art";

const lineMessage = {
  ok: null,
  limited: "Only a few left: quantity reduced.",
  unavailable: "No longer available.",
  sold: "Sold: this piece has found its home.",
  missing: "This item was removed from the shop.",
} as const;

export function BagDrawer() {
  const open = useBagDrawerOpen();
  const reduce = useReducedMotion();
  const items = useCart();
  const trpc = useTRPC();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  // Revalidate prices/stock every time the drawer opens or the bag changes.
  const { data, isFetching, isError } = useQuery({
    ...trpc.cart.validate.queryOptions({ items }),
    enabled: open && items.length > 0,
    staleTime: 0,
  });

  // Keep the stored bag honest: cap quantities to what's actually available.
  useEffect(() => {
    data?.lines.forEach((l) => {
      if (l.status === "limited") cart.setQuantity(l.variantId, l.quantity);
    });
  }, [data]);

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return bagDrawer.close();
      if (e.key !== "Tab" || !panelRef.current) return;
      const f = [...panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, [tabindex="0"]')];
      if (!f.length) return;
      const [first, last] = [f[0]!, f[f.length - 1]!];
      const wrapTo = e.shiftKey ? (document.activeElement === first ? last : null) : document.activeElement === last ? first : null;
      if (wrapTo) {
        e.preventDefault();
        wrapTo.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      returnFocus.current?.focus();
    };
  }, [open]);

  const blocked = !data || data.lines.some((l) => l.status !== "ok" && l.status !== "limited");
  const transition = reduce ? { duration: 0.15 } : ({ type: "spring", ...spring.default } as const);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[50]">
          <motion.div
            className="absolute inset-0 bg-forest/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={bagDrawer.close}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="bag-title"
            className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-canvas shadow-2xl"
            initial={reduce ? { opacity: 0 } : { x: "100%" }}
            animate={reduce ? { opacity: 1 } : { x: 0 }}
            exit={reduce ? { opacity: 0 } : { x: "100%" }}
            transition={transition}
          >
            <header className="flex items-center justify-between border-b border-forest/10 px-6 py-5">
              <h2 id="bag-title" className="text-display-sm">
                Your bag
              </h2>
              <button
                type="button"
                data-autofocus
                onClick={bagDrawer.close}
                className="text-label uppercase outline-offset-4 outline-forest focus-visible:outline-2"
              >
                Close
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-4" aria-busy={isFetching}>
              {items.length === 0 ? (
                <p className="py-16 text-center text-body-sm">Your bag is empty.</p>
              ) : isError ? (
                <p role="alert" className="py-16 text-center text-body-sm">
                  We couldn&apos;t check stock right now. Please try again.
                </p>
              ) : !data ? (
                <p className="py-16 text-center text-body-sm">Checking availability…</p>
              ) : (
                <ul className="divide-y divide-forest/10">
                  {data.lines.map((l) => (
                    <li key={l.variantId} className="flex gap-4 py-5">
                      <div className="relative aspect-[3/4] w-20 shrink-0 bg-stone chamfer-sm">
                        {l.item && (
                          <GarmentArt
                            item={{ silhouette: silhouetteFor(l.item.name), color: l.item.color, image: l.item.image }}
                            className="absolute inset-[12%] h-auto w-[76%]"
                          />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        {l.item ? (
                          <>
                            <Link href={`/product/${l.item.slug}`} onClick={bagDrawer.close} className="font-display text-display-sm leading-tight hover:underline">
                              {l.item.name}
                            </Link>
                            <p className="mt-1 text-body-sm opacity-70">
                              {l.item.size} · {l.item.color}
                              {l.item.mode === "UPCYCLED" && " · 1-of-1"}
                            </p>
                            <p className="mt-1 text-price tabular-nums">{formatKES(l.item.salePriceCents * Math.max(l.quantity, 1))}</p>
                          </>
                        ) : (
                          <p className="text-body-sm">Unavailable item</p>
                        )}
                        {lineMessage[l.status] && (
                          <p role="status" className="mt-2 text-body-sm font-medium text-espresso">
                            {lineMessage[l.status]}
                          </p>
                        )}
                        <div className="mt-auto flex items-center gap-3 pt-3">
                          {l.item?.mode === "NEW" && l.available > 0 && (
                            <div className="flex items-center border border-forest/20">
                              <button
                                type="button"
                                aria-label="Decrease quantity"
                                onClick={() => cart.setQuantity(l.variantId, l.quantity - 1)}
                                className="size-8 active:scale-[0.97]"
                              >
                                −
                              </button>
                              <span className="w-8 text-center tabular-nums" aria-live="polite">
                                {l.quantity}
                              </span>
                              <button
                                type="button"
                                aria-label="Increase quantity"
                                disabled={l.quantity >= l.available}
                                onClick={() => cart.setQuantity(l.variantId, l.quantity + 1)}
                                className="size-8 active:scale-[0.97] disabled:opacity-30"
                              >
                                +
                              </button>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => cart.remove(l.variantId)}
                            className="text-label uppercase underline-offset-4 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {data && items.length > 0 && (
              <footer className="border-t border-forest/10 px-6 py-5">
                <dl className="space-y-1 text-body-sm tabular-nums">
                  <div className="flex justify-between">
                    <dt>Subtotal</dt>
                    <dd>{formatKES(data.subtotalCents)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Shipping</dt>
                    <dd>{data.shippingCents === 0 ? "Free" : formatKES(data.shippingCents)}</dd>
                  </div>
                  <div className="flex justify-between pt-2 text-price">
                    <dt>Total</dt>
                    <dd>{formatKES(data.totalCents)}</dd>
                  </div>
                </dl>
                {blocked && (
                  <p role="alert" className="mt-3 text-body-sm text-espresso">
                    Remove unavailable items to continue.
                  </p>
                )}
                <Link
                  href="/checkout"
                  aria-disabled={blocked}
                  onClick={(e) => (blocked ? e.preventDefault() : bagDrawer.close())}
                  className="mt-4 block bg-forest py-4 text-center text-label uppercase text-canvas transition-transform duration-100 active:scale-[0.97] aria-disabled:cursor-not-allowed aria-disabled:opacity-40"
                >
                  Checkout
                </Link>
              </footer>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
