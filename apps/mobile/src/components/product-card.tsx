import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { availabilityLabel } from "@repo/types";
import { chamfer, colors } from "@repo/ui";
import { cart } from "@/lib/cart";
import type { ShowcaseItem } from "@/lib/showcase";
import { ChamferBackdrop } from "./chamfer";
import { GarmentArt } from "./garment-art";
import { PressableScale } from "./pressable-scale";
import { Price } from "./price";

export function BagIcon({ color = colors.canvas, size = 20 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 8h14l-1.2 12H6.2z" />
      <Path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </Svg>
  );
}

/** Signature chamfered card: pills top-left, ★ top-right, quick-add bottom-right. */
export function ProductCard({ item, width, tall = false }: { item: ShowcaseItem; width: number; tall?: boolean }) {
  const status = availabilityLabel(item);
  const unavailable = item.availability !== "in_stock";
  const inStock = item.variants.filter((v) => v.stock > 0);
  const pills = [item.discountPercent ? `-${item.discountPercent}%` : null, item.mode === "UPCYCLED" ? "Upcycled" : null, status].filter(Boolean) as string[];
  const open = () => router.push(`/product/${item.slug}`);

  const quickAdd = () => {
    // One option: add straight away. Several sizes: choose on the product page.
    if (inStock.length !== 1) return open();
    cart.add(inStock[0]!.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View style={{ width }}>
      <PressableScale onPress={open} accessibilityRole="link" accessibilityLabel={`${item.name}${status ? `, ${status}` : ""}`}>
        <ChamferBackdrop size={chamfer.md} fill={colors.stone} style={{ height: width * (tall ? 1.55 : 1.3) }} className="items-center justify-center">
          <View style={{ opacity: unavailable ? 0.45 : 1 }}>
            <GarmentArt item={item} width={width * 0.68} />
          </View>
          {pills.length > 0 && (
            <View className="absolute left-5 top-2.5 flex-row flex-wrap gap-1 pr-10">
              {pills.map((p) => (
                <Text key={p} className={`px-1.5 py-0.5 font-sans-medium text-label uppercase ${p.startsWith("-") ? "bg-tangerine text-forest" : "bg-forest text-canvas"}`}>
                  {p}
                </Text>
              ))}
            </View>
          )}
          {item.featured && (
            <View className="absolute right-2.5 top-2.5 h-7 w-7 items-center justify-center rounded-full bg-tangerine" accessibilityLabel="Editor's pick">
              <Text className="text-forest">★</Text>
            </View>
          )}
        </ChamferBackdrop>
      </PressableScale>
      <PressableScale
        onPress={quickAdd}
        disabled={unavailable}
        accessibilityRole="button"
        accessibilityLabel={unavailable ? `${item.name}: ${status}` : inStock.length === 1 ? `Add ${item.name} to bag` : `Choose a size for ${item.name}`}
        accessibilityState={{ disabled: unavailable }}
        hitSlop={8}
        className="absolute right-3 h-11 w-11 items-center justify-center rounded-full bg-forest"
        style={{ top: width * (tall ? 1.55 : 1.3) - 56, opacity: unavailable ? 0.4 : 1 }}
      >
        <BagIcon />
      </PressableScale>
      <Text className="mt-3 font-display text-display-sm text-forest" numberOfLines={2}>
        {item.name}
      </Text>
      <Price item={item} />
    </View>
  );
}
