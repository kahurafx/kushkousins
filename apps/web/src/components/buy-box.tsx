"use client";

import { useState } from "react";
import { compareSizes } from "@repo/types";
import { bagDrawer, cart } from "@/lib/cart";
import { availabilityLabel, type ShowcaseItem } from "@/lib/showcase";
import { Price } from "./price";

/** Size/colour selection + add to bag. Inline on desktop (sticky column), pinned bar on phones. */
export function BuyBox({ item }: { item: ShowcaseItem }) {
  const sizes = [...new Set(item.variants.map((v) => v.size))].sort(compareSizes);
  const colors = [...new Set(item.variants.map((v) => v.color))];
  const firstInStock = item.variants.find((v) => v.stock > 0) ?? item.variants[0];
  const [size, setSize] = useState(firstInStock?.size);
  const [color, setColor] = useState(firstInStock?.color);
  const variant = item.variants.find((v) => v.size === size && v.color === color);
  const status = availabilityLabel(item);
  const canAdd = !!variant && variant.stock > 0 && item.availability === "in_stock";
  const unique = item.mode === "UPCYCLED";

  const add = () => {
    if (!variant || !canAdd) return;
    cart.add(variant.id);
    bagDrawer.open();
  };
  const label = canAdd ? "Add to bag" : (status ?? "Out of stock in this size");

  const option = (selected: boolean, disabled: boolean) =>
    `min-w-12 border px-3 py-2 text-label uppercase transition-transform duration-100 active:scale-[0.97] ${
      selected ? "border-forest bg-forest text-canvas" : "border-forest/25"
    } ${disabled ? "line-through opacity-40" : ""}`;

  return (
    <>
      {unique ? (
        <p className="mt-8 text-body-sm">
          Size {variant?.size} · {variant?.color}. There is only one.
        </p>
      ) : (
        <div className="mt-8 space-y-6">
          {colors.length > 1 && (
            <fieldset>
              <legend className="mb-2 text-label uppercase opacity-60">Colour: {color}</legend>
              <div className="flex flex-wrap gap-2">
                {colors.map((c) => (
                  <button key={c} type="button" aria-pressed={c === color} onClick={() => setColor(c)} className={option(c === color, false)}>
                    {c}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          <fieldset>
            <legend className="mb-2 text-label uppercase opacity-60">Size</legend>
            <div className="flex flex-wrap gap-2">
              {sizes.map((s) => {
                const v = item.variants.find((x) => x.size === s && x.color === color);
                const out = !v || v.stock === 0;
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={s === size}
                    aria-label={out ? `${s}, out of stock` : s}
                    onClick={() => setSize(s)}
                    className={option(s === size, out)}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
            {variant && variant.stock > 0 && variant.stock <= 3 && (
              <p className="mt-2 text-body-sm text-espresso">Only {variant.stock} left</p>
            )}
          </fieldset>
        </div>
      )}

      <button
        type="button"
        onClick={add}
        disabled={!canAdd}
        className="mt-8 hidden w-full bg-forest py-4 text-label uppercase text-canvas transition-transform duration-100 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 lg:block"
      >
        {label}
      </button>

      {/* Pinned add-to-bag bar on phones/tablets */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-4 border-t border-forest/10 bg-canvas px-4 py-3 lg:hidden">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-display-sm leading-tight">{item.name}</p>
          <Price item={item} />
        </div>
        <button
          type="button"
          onClick={add}
          disabled={!canAdd}
          className="shrink-0 bg-forest px-6 py-3 text-label uppercase text-canvas transition-transform duration-100 active:scale-[0.97] disabled:opacity-40"
        >
          {canAdd ? "Add to bag" : (status ?? "Unavailable")}
        </button>
      </div>
    </>
  );
}
