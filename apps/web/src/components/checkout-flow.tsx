"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { RouterOutputs } from "@repo/api";
import { KenyanPhoneSchema, type AddressInput } from "@repo/types";
import { formatKES } from "@repo/ui";
import { cart, useCart } from "@/lib/cart";
import { useTRPC } from "@/lib/trpc";
import { AddressForm } from "./address-form";

type SavedAddress = RouterOutputs["address"]["list"][number];
type Step = "bag" | "address" | "review" | "payment";
const steps: { id: Step; label: string }[] = [
  { id: "bag", label: "Bag" },
  { id: "address", label: "Delivery" },
  { id: "review", label: "Review" },
  { id: "payment", label: "Payment" },
];

const primary =
  "w-full bg-forest py-4 text-label uppercase text-canvas transition-transform duration-100 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40";
const secondary = "text-label uppercase underline underline-offset-4";

const toInput = (a: SavedAddress): AddressInput => ({
  recipientName: a.recipientName,
  phone: a.phone,
  line1: a.line1,
  line2: a.line2 ?? undefined,
  city: a.city,
  county: a.county,
  postalCode: a.postalCode ?? undefined,
  label: a.label ?? undefined,
});

export function CheckoutFlow({ addresses, mockPayments }: { addresses: SavedAddress[]; mockPayments: boolean }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const items = useCart();
  const [step, setStep] = useState<Step>("bag");
  const [address, setAddress] = useState<AddressInput | null>(addresses[0] ? toInput(addresses[0]) : null);
  const [choice, setChoice] = useState<string>(addresses[0]?.id ?? "new");
  const [order, setOrder] = useState<{ id: string; totalCents: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const validate = useQuery({ ...trpc.cart.validate.queryOptions({ items }), enabled: items.length > 0 && !order, staleTime: 0 });
  const saveAddress = useMutation(trpc.address.create.mutationOptions());
  const createOrder = useMutation(trpc.order.create.mutationOptions());
  const cancelOrder = useMutation(trpc.order.cancel.mutationOptions());
  const pay = useMutation(trpc.order.mockPay.mutationOptions());

  const data = validate.data;
  const blocked = !data || data.lines.some((l) => l.status !== "ok");

  if (items.length === 0 && !order) {
    return (
      <div className="py-24 text-center">
        <p className="text-body">Your bag is empty.</p>
        <Link href="/shop/all" className={`mt-6 inline-block ${secondary}`}>Continue shopping</Link>
      </div>
    );
  }

  const go = (s: Step) => {
    setError(null);
    setStep(s);
    requestAnimationFrame(() => document.getElementById("checkout-step")?.focus());
  };

  async function placeOrder() {
    if (!address) return go("address");
    setError(null);
    try {
      const created = await createOrder.mutateAsync({ items, shippingAddress: address });
      setOrder(created);
      go("payment");
    } catch (e) {
      // CONFLICT: someone else got there first. Refresh the bag so the reason is visible.
      setError(e instanceof Error ? e.message : "We couldn't place your order.");
      await queryClient.invalidateQueries({ queryKey: trpc.cart.validate.queryKey() });
      setStep("bag");
    }
  }

  async function payNow(form: FormData) {
    if (!order) return;
    const phone = KenyanPhoneSchema.safeParse(String(form.get("mpesa") ?? ""));
    if (!phone.success) return setPhoneError(phone.error.issues[0]?.message ?? "Enter a valid phone number");
    setPhoneError(null);
    try {
      await pay.mutateAsync({ orderId: order.id, phone: phone.data });
      cart.clear();
      router.push(`/checkout/confirmation/${order.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed. Please try again.");
    }
  }

  async function cancel() {
    if (!order) return;
    await cancelOrder.mutateAsync({ orderId: order.id }).catch(() => {});
    setOrder(null);
    go("bag");
  }

  const currentIndex = steps.findIndex((s) => s.id === step);

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div>
        <ol className="flex gap-6 border-b border-forest/10 pb-4" aria-label="Checkout steps">
          {steps.map((s, i) => (
            <li key={s.id} aria-current={s.id === step ? "step" : undefined} className={`text-label uppercase ${i <= currentIndex ? "" : "opacity-40"} aria-[current=step]:underline aria-[current=step]:underline-offset-8`}>
              {i + 1}. {s.label}
            </li>
          ))}
        </ol>

        {error && (
          <p role="alert" className="mt-6 bg-espresso p-4 text-body-sm text-canvas">
            {error}
          </p>
        )}

        <section id="checkout-step" tabIndex={-1} className="mt-8 outline-none">
          {step === "bag" && (
            <>
              <h2 className="text-display-sm">Your bag</h2>
              {!data ? (
                <p className="mt-6 text-body-sm">Checking availability…</p>
              ) : (
                <ul className="mt-6 divide-y divide-forest/10">
                  {data.lines.map((l) => (
                    <li key={l.variantId} className="flex items-start justify-between gap-4 py-4">
                      <div>
                        <p className="font-display text-display-sm leading-tight">{l.item?.name ?? "Unavailable item"}</p>
                        {l.item && <p className="text-body-sm opacity-70">{l.item.size} · {l.item.color} · Qty {l.requested}</p>}
                        {l.status !== "ok" && (
                          <p className="mt-1 text-body-sm text-espresso">
                            {l.status === "limited" ? `Only ${l.available} available.` : l.status === "sold" ? "Sold." : "No longer available."}{" "}
                            <button type="button" className="underline" onClick={() => (l.status === "limited" ? cart.setQuantity(l.variantId, l.available) : cart.remove(l.variantId))}>
                              {l.status === "limited" ? "Update quantity" : "Remove"}
                            </button>
                          </p>
                        )}
                      </div>
                      {l.item && <p className="text-price tabular-nums">{formatKES(l.item.salePriceCents * l.requested)}</p>}
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className={`mt-8 ${primary}`} disabled={blocked} onClick={() => go("address")}>
                Continue to delivery
              </button>
            </>
          )}

          {step === "address" && (
            <>
              <h2 className="text-display-sm">Delivery address</h2>
              {addresses.length > 0 && (
                <fieldset className="mt-6 space-y-3">
                  <legend className="sr-only">Choose an address</legend>
                  {addresses.map((a) => (
                    <label key={a.id} className="flex cursor-pointer gap-3 border border-forest/20 p-4 has-[:checked]:border-forest">
                      <input type="radio" name="addr" checked={choice === a.id} onChange={() => { setChoice(a.id); setAddress(toInput(a)); }} />
                      <span className="text-body-sm">
                        <strong className="font-medium">{a.label ?? a.recipientName}</strong>
                        <br />
                        {a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.county} · {a.phone}
                      </span>
                    </label>
                  ))}
                  <label className="flex cursor-pointer gap-3 border border-forest/20 p-4 has-[:checked]:border-forest">
                    <input type="radio" name="addr" checked={choice === "new"} onChange={() => setChoice("new")} />
                    <span className="text-body-sm">Use a new address</span>
                  </label>
                </fieldset>
              )}
              <div className="mt-6">
                {choice === "new" ? (
                  <AddressForm
                    submitLabel="Continue to review"
                    pending={saveAddress.isPending}
                    extra={
                      <label className="flex items-center gap-2 text-body-sm">
                        <input type="checkbox" name="save" defaultChecked /> Save to my addresses
                      </label>
                    }
                    onSubmit={async (values, form) => {
                      if (form.get("save")) await saveAddress.mutateAsync(values).catch(() => {});
                      setAddress(values);
                      go("review");
                    }}
                  />
                ) : (
                  <button type="button" className={primary} onClick={() => go("review")}>
                    Continue to review
                  </button>
                )}
              </div>
              <button type="button" className={`mt-6 ${secondary}`} onClick={() => go("bag")}>Back to bag</button>
            </>
          )}

          {step === "review" && address && (
            <>
              <h2 className="text-display-sm">Review</h2>
              <div className="mt-6 border border-forest/20 p-4 text-body-sm">
                <p className="text-label uppercase opacity-60">Deliver to</p>
                <p className="mt-2">
                  {address.recipientName} · {address.phone}
                  <br />
                  {address.line1}{address.line2 ? `, ${address.line2}` : ""}, {address.city}, {address.county}
                </p>
                <button type="button" className={`mt-3 ${secondary}`} onClick={() => go("address")}>Change</button>
              </div>
              <p className="mt-6 text-body-sm opacity-80">Placing your order reserves these pieces for you while you pay.</p>
              <button type="button" className={`mt-6 ${primary}`} disabled={blocked || createOrder.isPending} onClick={placeOrder}>
                {createOrder.isPending ? "Reserving…" : `Place order · ${data ? formatKES(data.totalCents) : ""}`}
              </button>
            </>
          )}

          {step === "payment" && order && (
            <>
              <h2 className="text-display-sm">Pay with M-Pesa</h2>
              {!mockPayments ? (
                <p role="alert" className="mt-6 text-body-sm">
                  Online payment isn&apos;t live yet. Your pieces are reserved. We&apos;ll be in touch to complete payment.
                </p>
              ) : (
                <form
                  className="mt-6 space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    payNow(new FormData(e.currentTarget));
                  }}
                >
                  <p className="bg-stone p-3 text-body-sm">Test mode: no real M-Pesa prompt is sent. Payment is simulated.</p>
                  <label className="block text-label uppercase">
                    M-Pesa phone number
                    <input
                      name="mpesa"
                      type="tel"
                      autoComplete="tel"
                      defaultValue={address?.phone ?? ""}
                      aria-invalid={phoneError ? true : undefined}
                      aria-describedby={phoneError ? "mpesa-error" : undefined}
                      className="mt-1 block w-full border border-forest/25 bg-transparent px-3 py-2.5 text-body"
                    />
                    {phoneError && <span id="mpesa-error" className="mt-1 block normal-case tracking-normal text-espresso">{phoneError}</span>}
                  </label>
                  <button type="submit" className={primary} disabled={pay.isPending}>
                    {pay.isPending ? "Confirming…" : `Pay ${formatKES(order.totalCents)}`}
                  </button>
                </form>
              )}
              <button type="button" className={`mt-6 ${secondary}`} onClick={cancel} disabled={cancelOrder.isPending}>
                Cancel order and release items
              </button>
            </>
          )}
        </section>
      </div>

      <aside aria-label="Order summary" className="h-fit bg-stone p-6 chamfer-md lg:sticky lg:top-28">
        <h2 className="text-label uppercase">Summary</h2>
        {data && (
          <dl className="mt-4 space-y-2 text-body-sm tabular-nums">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatKES(data.subtotalCents)}</dd></div>
            <div className="flex justify-between"><dt>Shipping</dt><dd>{data.shippingCents === 0 ? "Free" : formatKES(data.shippingCents)}</dd></div>
            <div className="flex justify-between border-t border-forest/15 pt-2 text-price"><dt>Total</dt><dd>{formatKES(order?.totalCents ?? data.totalCents)}</dd></div>
          </dl>
        )}
      </aside>
    </div>
  );
}
