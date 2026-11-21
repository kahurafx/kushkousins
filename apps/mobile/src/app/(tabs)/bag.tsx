import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatKES, silhouetteFor } from "@repo/ui";
import { GarmentArt } from "@/components/garment-art";
import { PressableScale } from "@/components/pressable-scale";
import { ErrorState, Loading } from "@/components/screen";
import { cart, useCart } from "@/lib/cart";
import { useTRPC } from "@/lib/trpc";

const message = { ok: null, limited: "Only a few left: quantity reduced.", unavailable: "No longer available.", sold: "Sold.", missing: "Removed from the shop." } as const;

export default function Bag() {
  const trpc = useTRPC();
  const items = useCart();
  const q = useQuery({ ...trpc.cart.validate.queryOptions({ items }), enabled: items.length > 0, staleTime: 0 });

  useEffect(() => {
    q.data?.lines.forEach((l) => l.status === "limited" && cart.setQuantity(l.variantId, l.quantity));
  }, [q.data]);

  const blocked = !q.data || q.data.lines.some((l) => l.status !== "ok" && l.status !== "limited");

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-canvas">
      <Text className="px-4 pt-4 font-display text-display-lg text-forest">Your bag</Text>
      {items.length === 0 ? (
        <ErrorState message="Your bag is empty." />
      ) : q.isPending ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState message="We couldn't check stock right now. Pull to retry." />
      ) : (
        <>
          <ScrollView contentContainerClassName="px-4 pb-8">
            {q.data.lines.map((l) => (
              <View key={l.variantId} className="flex-row gap-4 border-b border-forest/10 py-5">
                <View className="h-28 w-20 items-center justify-center bg-stone">
                  {l.item && <GarmentArt item={{ silhouette: silhouetteFor(l.item.name), color: l.item.color }} width={56} />}
                </View>
                <View className="flex-1">
                  <Text className="font-display text-display-sm text-forest">{l.item?.name ?? "Unavailable item"}</Text>
                  {l.item && (
                    <Text className="mt-1 font-sans text-body-sm text-forest/70">
                      {l.item.size} · {l.item.color}
                      {l.item.mode === "UPCYCLED" ? " · 1-of-1" : ""}
                    </Text>
                  )}
                  {l.item && <Text className="mt-1 font-sans-medium text-price text-forest">{formatKES(l.item.salePriceCents * Math.max(l.quantity, 1))}</Text>}
                  {message[l.status] && <Text className="mt-2 font-sans-medium text-body-sm text-espresso">{message[l.status]}</Text>}
                  <View className="mt-3 flex-row items-center gap-4">
                    {l.item?.mode === "NEW" && l.available > 0 && (
                      <View className="flex-row items-center border border-forest/20">
                        <Pressable accessibilityLabel="Decrease quantity" onPress={() => cart.setQuantity(l.variantId, l.quantity - 1)} className="h-9 w-9 items-center justify-center">
                          <Text className="text-forest">−</Text>
                        </Pressable>
                        <Text className="w-8 text-center font-sans text-forest">{l.quantity}</Text>
                        <Pressable accessibilityLabel="Increase quantity" disabled={l.quantity >= l.available} onPress={() => cart.setQuantity(l.variantId, l.quantity + 1)} className="h-9 w-9 items-center justify-center" style={{ opacity: l.quantity >= l.available ? 0.3 : 1 }}>
                          <Text className="text-forest">+</Text>
                        </Pressable>
                      </View>
                    )}
                    <Pressable onPress={() => cart.remove(l.variantId)} hitSlop={8}>
                      <Text className="font-sans-medium text-label uppercase text-forest underline">Remove</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
          <View className="border-t border-forest/10 px-4 pb-4 pt-4">
            {[["Subtotal", formatKES(q.data.subtotalCents)], ["Shipping", q.data.shippingCents === 0 ? "Free" : formatKES(q.data.shippingCents)], ["Total", formatKES(q.data.totalCents)]].map(([k, v]) => (
              <View key={k} className="flex-row justify-between py-0.5">
                <Text className={`font-sans text-forest ${k === "Total" ? "text-price" : "text-body-sm"}`}>{k}</Text>
                <Text className={`text-forest ${k === "Total" ? "font-sans-medium text-price" : "font-sans text-body-sm"}`}>{v}</Text>
              </View>
            ))}
            {blocked && <Text className="mt-2 font-sans text-body-sm text-espresso">Remove unavailable items to continue.</Text>}
            <PressableScale disabled={blocked} onPress={() => router.push("/checkout")} accessibilityRole="button" className="mt-4 items-center bg-forest py-4" style={{ opacity: blocked ? 0.4 : 1 }}>
              <Text className="font-sans-medium text-label uppercase text-canvas">Checkout</Text>
            </PressableScale>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
