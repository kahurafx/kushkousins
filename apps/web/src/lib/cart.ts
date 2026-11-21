"use client";

import { useSyncExternalStore } from "react";
import type { CartItem } from "@repo/types";

// Client-side bag: only {variantId, quantity}. Prices and stock always come from cart.validate.
const KEY = "kk.cart.v1";
const EMPTY: CartItem[] = [];
const listeners = new Set<() => void>();
let items: CartItem[] | null = null; // lazily loaded on first client read

function load(): CartItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((i) => typeof i?.variantId === "string" && Number.isInteger(i?.quantity) && i.quantity > 0)
      : [];
  } catch {
    return [];
  }
}

function set(next: CartItem[]) {
  items = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // private mode / quota: the bag still works for this tab
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      items = load();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const snapshot = () => (items ??= load());

export const cart = {
  add(variantId: string, quantity = 1) {
    const cur = snapshot();
    const found = cur.find((i) => i.variantId === variantId);
    set(
      found
        ? cur.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.min(20, i.quantity + quantity) } : i))
        : [...cur, { variantId, quantity }],
    );
  },
  setQuantity(variantId: string, quantity: number) {
    set(quantity <= 0 ? snapshot().filter((i) => i.variantId !== variantId) : snapshot().map((i) => (i.variantId === variantId ? { ...i, quantity: Math.min(20, quantity) } : i)));
  },
  remove(variantId: string) {
    set(snapshot().filter((i) => i.variantId !== variantId));
  },
  clear() {
    set([]);
  },
};

/** Server snapshot is empty, so the header count never causes a hydration mismatch. */
export const useCart = () => useSyncExternalStore(subscribe, snapshot, () => EMPTY);
export const useCartCount = () => useCart().reduce((n, i) => n + i.quantity, 0);

// Drawer open state: a tiny shared store so the header, quick-add and PDP can all open it.
let drawerOpen = false;
const drawerListeners = new Set<() => void>();
export const bagDrawer = {
  open: () => ((drawerOpen = true), drawerListeners.forEach((l) => l())),
  close: () => ((drawerOpen = false), drawerListeners.forEach((l) => l())),
};
export const useBagDrawerOpen = () =>
  useSyncExternalStore(
    (l) => (drawerListeners.add(l), () => drawerListeners.delete(l)),
    () => drawerOpen,
    () => false,
  );
