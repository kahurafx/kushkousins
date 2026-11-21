import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { AddressSchema, KenyanPhoneSchema, RESERVATION_MINUTES, stkFailureMessage, type AddressInput } from "@repo/types";
import { formatKES } from "@repo/ui";
import { PressableScale } from "@/components/pressable-scale";
import { ErrorState, Loading } from "@/components/screen";
import { useSession } from "@/lib/auth-client";
import { cart, useCart } from "@/lib/cart";
import { useTRPC } from "@/lib/trpc";

const field = "mt-1 border border-forest/25 px-3 py-2.5 font-sans text-body text-forest";
const fields: { key: keyof AddressInput; label: string; optional?: boolean; keyboard?: "phone-pad" }[] = [
  { key: "recipientName", label: "Full name" },
  { key: "phone", label: "Phone", keyboard: "phone-pad" },
  { key: "line1", label: "Street address" },
  { key: "line2", label: "Apartment, building (optional)", optional: true },
  { key: "city", label: "Town / city" },
  { key: "county", label: "County" },
];

function Primary({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <PressableScale onPress={onPress} disabled={disabled} accessibilityRole="button" className="mt-6 items-center bg-forest py-4" style={{ opacity: disabled ? 0.4 : 1 }}>
      <Text className="font-sans-medium text-label uppercase text-canvas">{label}</Text>
    </PressableScale>
  );
}

export default function Checkout() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const items = useCart();
  const { data: session, isPending: sessionPending } = useSession();
  const addresses = useQuery({ ...trpc.address.list.queryOptions(), enabled: !!session });
  const bag = useQuery({ ...trpc.cart.validate.queryOptions({ items }), enabled: items.length > 0, staleTime: 0 });
  const createOrder = useMutation(trpc.order.create.mutationOptions());
  const saveAddress = useMutation(trpc.address.create.mutationOptions());
  const pay = useMutation(trpc.order.pay.mutationOptions());
  const cancel = useMutation(trpc.order.cancel.mutationOptions());

  const [choice, setChoice] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<Partial<Record<keyof AddressInput, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<keyof AddressInput, string>>>({});
  const [order, setOrder] = useState<{ id: string; totalCents: number } | null>(null);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [waiting, setWaiting] = useState(false); // STK prompt sent; polling until the callback lands
  // Poll while the prompt is on the phone; stop at a final answer. The server asks Safaricom if the callback is late.
  const { data: status } = useQuery({
    ...trpc.order.paymentStatus.queryOptions({ orderId: order?.id ?? "00000000-0000-0000-0000-000000000000" }),
    enabled: waiting && !!order,
    staleTime: 0,
    refetchInterval: (q) => (q.state.data?.status === "pending_payment" && q.state.data.payment?.status !== "failed" ? 3000 : false),
  });
  const settled = !!status && status.status !== "pending_payment" && status.status !== "cancelled";
  const payFailure =
    status?.status === "cancelled"
      ? "This order's reservation was released before payment arrived. If M-Pesa took your money, we'll refund it. Please order again from your bag."
      : status?.payment?.status === "failed"
        ? stkFailureMessage(status.payment.resultCode, status.payment.resultDesc)
        : null;
  const prompting = waiting && !!order && !settled && !payFailure;
  useEffect(() => {
    if (!settled) return;
    cart.clear();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    queryClient.invalidateQueries({ queryKey: trpc.order.mine.queryKey() });
  }, [settled, queryClient, trpc]);

  if (sessionPending) return <Loading />;
  if (!session) {
    return (
      <View className="flex-1 bg-canvas px-6 pt-10">
        <Text className="font-display text-display-md text-forest">Sign in to check out</Text>
        <Text className="mt-2 font-sans text-body text-forest/80">Your bag is saved on this phone.</Text>
        {/* No `next`: the auth modal's router.back() already returns here. */}
        <Primary label="Sign in or create an account" onPress={() => router.push("/auth")} />
      </View>
    );
  }
  if ((paid || settled) && order) {
    return (
      <View className="flex-1 items-center bg-canvas px-6 pt-16">
        <Text className="font-sans-medium text-label uppercase text-forest">Payment received</Text>
        <Text className="mt-3 font-display text-display-lg text-forest">Thank you</Text>
        <Text className="mt-3 text-center font-sans text-body text-forest">Order #{order.id.slice(0, 8).toUpperCase()} is confirmed. We&apos;ll let you know when it ships.</Text>
        <Primary label="Keep shopping" onPress={() => router.replace("/")} />
      </View>
    );
  }
  if (items.length === 0 && !order) return <ErrorState message="Your bag is empty." />;
  if (addresses.isPending || (bag.isPending && !order)) return <Loading />;

  const saved = addresses.data ?? [];
  const selected = choice ?? saved[0]?.id ?? "new";
  const savedAddress = saved.find((a) => a.id === selected);

  function resolveAddress(): AddressInput | null {
    if (savedAddress) {
      const { recipientName, phone, line1, line2, city, county, postalCode, label } = savedAddress;
      return { recipientName, phone, line1, line2: line2 ?? undefined, city, county, postalCode: postalCode ?? undefined, label: label ?? undefined };
    }
    const parsed = AddressSchema.safeParse(Object.fromEntries(fields.map((f) => [f.key, form[f.key]?.trim() || undefined])));
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const i of parsed.error.issues) next[i.path[0] as keyof AddressInput] ??= i.message;
      setErrors(next);
      return null;
    }
    setErrors({});
    return parsed.data;
  }

  async function placeOrder() {
    setError(null);
    const address = resolveAddress();
    if (!address) return;
    try {
      if (selected === "new") await saveAddress.mutateAsync({ ...address, isDefault: saved.length === 0 }).catch(() => {});
      const created = await createOrder.mutateAsync({ items, shippingAddress: address });
      setOrder(created);
      setPhone(address.phone);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't place your order.");
      await queryClient.invalidateQueries({ queryKey: trpc.cart.validate.queryKey() });
    }
  }

  async function payNow() {
    if (!order) return;
    const p = KenyanPhoneSchema.safeParse(phone);
    if (!p.success) return setError(p.error.issues[0]?.message ?? "Enter a Kenyan mobile number");
    setError(null);
    setWaiting(false);
    try {
      const r = await pay.mutateAsync({ orderId: order.id, phone: p.data });
      if (r.status === "pending_payment") {
        queryClient.removeQueries({ queryKey: trpc.order.paymentStatus.queryKey({ orderId: order.id }) });
        return setWaiting(true);
      }
      cart.clear();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await queryClient.invalidateQueries({ queryKey: trpc.order.mine.queryKey() });
      setPaid(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed.");
    }
  }

  const blocked = !bag.data || bag.data.lines.some((l) => l.status !== "ok");

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-canvas">
      <ScrollView contentContainerClassName="px-4 pb-16 pt-4" keyboardShouldPersistTaps="handled">
        {error && (
          <Text accessibilityRole="alert" className="mb-4 bg-espresso p-4 font-sans text-body-sm text-canvas">
            {error}
          </Text>
        )}

        {!order ? (
          <>
            <Text className="font-sans-medium text-label uppercase text-forest">Deliver to</Text>
            <View className="mt-3 gap-2">
              {saved.map((a) => (
                <Pressable key={a.id} onPress={() => setChoice(a.id)} accessibilityRole="radio" accessibilityState={{ checked: selected === a.id }} className={`border p-4 ${selected === a.id ? "border-forest" : "border-forest/20"}`}>
                  <Text className="font-sans-medium text-body text-forest">{a.label ?? a.recipientName}</Text>
                  <Text className="font-sans text-body-sm text-forest/80">{a.line1}, {a.city}, {a.county} · {a.phone}</Text>
                </Pressable>
              ))}
              {saved.length > 0 && (
                <Pressable onPress={() => setChoice("new")} accessibilityRole="radio" accessibilityState={{ checked: selected === "new" }} className={`border p-4 ${selected === "new" ? "border-forest" : "border-forest/20"}`}>
                  <Text className="font-sans text-body text-forest">Use a new address</Text>
                </Pressable>
              )}
            </View>
            {selected === "new" && (
              <View className="mt-4 gap-4">
                {fields.map((f) => (
                  <View key={f.key}>
                    <Text className="font-sans-medium text-label uppercase text-forest">{f.label}</Text>
                    <TextInput
                      value={form[f.key] ?? ""}
                      onChangeText={(v) => setForm((s) => ({ ...s, [f.key]: v }))}
                      keyboardType={f.keyboard}
                      accessibilityLabel={f.label}
                      className={`${field} ${errors[f.key] ? "border-espresso" : ""}`}
                    />
                    {errors[f.key] && <Text className="mt-1 font-sans text-body-sm text-espresso">{f.key === "phone" ? errors[f.key] : "Please fill this in."}</Text>}
                  </View>
                ))}
              </View>
            )}

            {bag.data && (
              <View className="mt-8 bg-stone p-5">
                <Text className="font-sans-medium text-label uppercase text-forest">Summary</Text>
                {bag.data.lines.map((l) => (
                  <Text key={l.variantId} className={`mt-2 font-sans text-body-sm ${l.status === "ok" ? "text-forest" : "text-espresso"}`}>
                    {l.item?.name ?? "Unavailable"} · {l.item?.size} · Qty {l.requested}
                    {l.status !== "ok" ? " (no longer available)" : ""}
                  </Text>
                ))}
                <Text className="mt-3 font-sans text-body-sm text-forest">Shipping: {bag.data.shippingCents === 0 ? "Free" : formatKES(bag.data.shippingCents)}</Text>
                <Text className="mt-1 font-sans-medium text-price text-forest">Total {formatKES(bag.data.totalCents)}</Text>
              </View>
            )}
            {blocked && <Text className="mt-3 font-sans text-body-sm text-espresso">Some items are no longer available. Update your bag to continue.</Text>}
            <Primary label={createOrder.isPending ? "Reserving…" : "Place order"} onPress={placeOrder} disabled={blocked || createOrder.isPending} />
            <Text className="mt-3 text-center font-sans text-body-sm text-forest/70">Placing your order reserves these pieces while you pay.</Text>
          </>
        ) : (
          <>
            <Text className="font-display text-display-md text-forest">Pay with M-Pesa</Text>
            {payFailure && (
              <Text accessibilityRole="alert" className="mt-4 bg-espresso p-4 font-sans text-body-sm text-canvas">
                {payFailure}
              </Text>
            )}
            {prompting ? (
              <View accessibilityLiveRegion="polite" className="mt-5 border border-forest/20 p-5">
                <Text className="font-sans-medium text-label uppercase text-forest">Check your phone</Text>
                <Text className="mt-2 font-sans text-body text-forest">
                  Enter your M-Pesa PIN on the prompt to pay {formatKES(order.totalCents)}. This screen updates by itself.
                </Text>
                <Text className="mt-2 font-sans text-body-sm text-forest/70">No prompt? Make sure your phone is on and unlocked. A new prompt can be sent once this one ends, after about a minute.</Text>
                <Pressable className="mt-3" accessibilityRole="button" onPress={() => setWaiting(false)}>
                  <Text className="font-sans-medium text-label uppercase text-forest underline">Send again or change number</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text className="mt-3 font-sans text-body-sm text-forest/80">We hold your pieces for {RESERVATION_MINUTES} minutes while you pay.</Text>
                <Text className="mt-5 font-sans-medium text-label uppercase text-forest">M-Pesa phone number</Text>
                <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" accessibilityLabel="M-Pesa phone number" className={field} />
                <Primary label={pay.isPending ? "Sending prompt…" : `Pay ${formatKES(order.totalCents)}`} onPress={payNow} disabled={pay.isPending} />
              </>
            )}
            <Pressable
              className="mt-6"
              accessibilityRole="button"
              disabled={prompting}
              style={{ opacity: prompting ? 0.4 : 1 }}
              onPress={async () => {
                try {
                  await cancel.mutateAsync({ orderId: order.id });
                  setOrder(null);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "We couldn't cancel this order.");
                }
              }}
            >
              <Text className="text-center font-sans-medium text-label uppercase text-forest underline">Cancel order and release items</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
