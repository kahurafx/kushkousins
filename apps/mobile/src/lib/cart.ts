import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import type { CartItem } from "@repo/types";

// Bag on device: only {variantId, quantity}. Prices and stock always come from cart.validate.
const KEY = "kk.cart.v1";
let items: CartItem[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const valid = (v: unknown): CartItem[] =>
  Array.isArray(v)
    ? v.filter((i) => typeof i?.variantId === "string" && Number.isInteger(i?.quantity) && i.quantity > 0 && i.quantity <= 20)
    : [];

// Hydrate once at startup; until then the bag reads as empty.
AsyncStorage.getItem(KEY)
  .then((raw) => {
    items = valid(JSON.parse(raw ?? "[]"));
    emit();
  })
  .catch(() => {});

function set(next: CartItem[]) {
  items = next;
  emit();
  AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {}); // storage failure: bag still works this session
}

export const cart = {
  add(variantId: string, quantity = 1) {
    const found = items.find((i) => i.variantId === variantId);
    set(found ? items.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.min(20, i.quantity + quantity) } : i)) : [...items, { variantId, quantity }]);
  },
  setQuantity(variantId: string, quantity: number) {
    set(quantity <= 0 ? items.filter((i) => i.variantId !== variantId) : items.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.min(20, quantity) } : i)));
  },
  remove: (variantId: string) => set(items.filter((i) => i.variantId !== variantId)),
  clear: () => set([]),
};

const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));
export const useCart = () => useSyncExternalStore(subscribe, () => items);
export const useCartCount = () => useCart().reduce((n, i) => n + i.quantity, 0);
