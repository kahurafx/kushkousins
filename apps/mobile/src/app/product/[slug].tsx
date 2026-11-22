import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { availabilityLabel, compareSizes } from "@repo/types";
import { chamfer, colors } from "@repo/ui";
import { ChamferBackdrop } from "@/components/chamfer";
import { GarmentArt } from "@/components/garment-art";
import { PressableScale } from "@/components/pressable-scale";
import { Price } from "@/components/price";
import { ErrorState, Loading } from "@/components/screen";
import { SimilarProducts } from "@/components/similar-products";
import { cart } from "@/lib/cart";
import { toShowcaseItem } from "@/lib/showcase";
import { useTRPC } from "@/lib/trpc";

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const trpc = useTRPC();
  const { width } = useWindowDimensions();
  const q = useQuery({ ...trpc.product.bySlug.queryOptions({ slug }), retry: false });
  const [choice, setChoice] = useState<{ size?: string; color?: string }>({});

  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState message={q.error.data?.code === "NOT_FOUND" ? "This piece isn't in the shop." : undefined} />;

  const p = q.data;
  const item = toShowcaseItem(p);
  const unique = p.mode === "UPCYCLED";
  const first = item.variants.find((v) => v.stock > 0) ?? item.variants[0];
  const size = choice.size ?? first?.size;
  const color = choice.color ?? first?.color;
  const variant = item.variants.find((v) => v.size === size && v.color === color);
  const status = availabilityLabel(item);
  const canAdd = !!variant && variant.stock > 0 && item.availability === "in_stock";
  const sizes = [...new Set(item.variants.map((v) => v.size))].sort(compareSizes);
  const colours = [...new Set(item.variants.map((v) => v.color))];

  const add = () => {
    if (!variant || !canAdd) return;
    cart.add(variant.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.navigate("/bag");
  };
  const option = (selected: boolean) => `min-w-12 items-center border px-3 py-2 ${selected ? "border-forest bg-forest" : "border-forest/25"}`;

  return (
    <SafeAreaView edges={["bottom"]} className="flex-1 bg-canvas">
      <Stack.Screen options={{ title: p.category?.name ?? "" }} />
      <ScrollView contentContainerClassName="pb-8">
        <ChamferBackdrop size={chamfer.lg} fill={colors.stone} className="mx-4 items-center justify-center" style={{ height: width * 1.15 }}>
          <GarmentArt item={item} width={width * 0.6} />
          {status && <Text className="absolute left-8 top-4 bg-forest px-2 py-1 font-sans-medium text-label uppercase text-canvas">{status}</Text>}
        </ChamferBackdrop>

        <View className="px-4 pt-6">
          <Text className={`self-start font-sans-medium text-label uppercase ${unique ? "bg-tangerine px-2 py-1 text-forest" : "text-forest/70"}`}>{unique ? "1-of-1 Unique Piece" : "New"}</Text>
          <Text accessibilityRole="header" className="mt-3 font-display text-display-md text-forest">{p.name}</Text>
          <View className="mt-2">
            <Price item={item} large />
          </View>
          {p.description && <Text className="mt-5 font-sans text-body text-forest">{p.description}</Text>}

          {unique && (p.originalMaterial || p.artisanNotes) && (
            <View className="mt-6 bg-espresso p-5">
              <Text className="font-sans-medium text-label uppercase text-canvas">Provenance</Text>
              {p.originalMaterial && <Text className="mt-2 font-sans text-body-sm text-canvas">Made from {p.originalMaterial}</Text>}
              {p.artisanNotes && <Text className="mt-3 font-display-italic text-display-sm text-canvas">“{p.artisanNotes}”</Text>}
            </View>
          )}

          {unique ? (
            <Text className="mt-6 font-sans text-body-sm text-forest">Size {variant?.size} · {variant?.color}. There is only one.</Text>
          ) : (
            <View className="mt-6 gap-5">
              {colours.length > 1 && (
                <View>
                  <Text className="font-sans-medium text-label uppercase text-forest/60">Colour: {color}</Text>
                  <View className="mt-2 flex-row flex-wrap gap-2">
                    {colours.map((c) => (
                      <Pressable key={c} onPress={() => setChoice({ size, color: c })} accessibilityRole="button" accessibilityState={{ selected: c === color }} className={option(c === color)}>
                        <Text className={`font-sans-medium text-label uppercase ${c === color ? "text-canvas" : "text-forest"}`}>{c}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
              <View>
                <Text className="font-sans-medium text-label uppercase text-forest/60">Size</Text>
                <View className="mt-2 flex-row flex-wrap gap-2">
                  {sizes.map((s) => {
                    const v = item.variants.find((x) => x.size === s && x.color === color);
                    const out = !v || v.stock === 0;
                    return (
                      <Pressable key={s} onPress={() => setChoice({ size: s, color })} accessibilityRole="button" accessibilityLabel={out ? `${s}, out of stock` : s} accessibilityState={{ selected: s === size }} className={option(s === size)} style={{ opacity: out ? 0.4 : 1 }}>
                        <Text className={`font-sans-medium text-label uppercase ${s === size ? "text-canvas" : "text-forest"} ${out ? "line-through" : ""}`}>{s}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {variant && variant.stock > 0 && variant.stock <= 3 && <Text className="mt-2 font-sans text-body-sm text-espresso">Only {variant.stock} left</Text>}
              </View>
            </View>
          )}
        </View>

        <SimilarProducts productId={p.id} />
      </ScrollView>

      {/* Pinned add-to-bag bar */}
      <View className="flex-row items-center gap-4 border-t border-forest/10 bg-canvas px-4 py-3">
        <View className="flex-1">
          <Text numberOfLines={1} className="font-display text-display-sm text-forest">{p.name}</Text>
          <Price item={item} />
        </View>
        <PressableScale onPress={add} disabled={!canAdd} accessibilityRole="button" className="bg-forest px-6 py-3" style={{ opacity: canAdd ? 1 : 0.4 }}>
          <Text className="font-sans-medium text-label uppercase text-canvas">{canAdd ? "Add to bag" : (status ?? "Unavailable")}</Text>
        </PressableScale>
      </View>
    </SafeAreaView>
  );
}
