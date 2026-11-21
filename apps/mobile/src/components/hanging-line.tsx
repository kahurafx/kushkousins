import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, type SharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { availabilityLabel } from "@repo/types";
import { colors, hangingLine, snapIndex } from "@repo/ui";
import type { ShowcaseItem } from "@/lib/showcase";
import { GarmentArt } from "./garment-art";
import { Price } from "./price";

function Garment({ item, index, slot, offset, reduce }: { item: ShowcaseItem; index: number; slot: number; offset: SharedValue<number>; reduce: boolean }) {
  // Scale follows the finger continuously (UI thread): centred garment comes forward from its hook.
  const style = useAnimatedStyle(() => {
    if (reduce) return {};
    const d = Math.abs(offset.value / slot - index);
    return { transform: [{ scale: interpolate(d, [0, 1], [hangingLine.activeScale, 0.9], "clamp") }], opacity: interpolate(d, [0, 2], [1, 0.55], "clamp") };
  });
  return (
    <Pressable
      onPress={() => router.push(`/product/${item.slug}`)}
      accessibilityRole="link"
      accessibilityLabel={`${item.name}, ${item.mode === "UPCYCLED" ? "one of a kind" : "new"}`}
      style={{ width: slot, alignItems: "center" }}
    >
      <Animated.View style={[{ transformOrigin: "50% 0%" }, style]}>
        <GarmentArt item={item} hanger width={slot * 0.86} />
      </Animated.View>
    </Pressable>
  );
}

/**
 * Touch Hanging Line. Native snapping scroll gives platform momentum + iOS edge bounce; the centred
 * garment scales up and its card appears; a light haptic marks each new snap (not every frame).
 */
export function HangingLine({ items }: { items: ShowcaseItem[] }) {
  const { width } = useWindowDimensions();
  const slot = Math.round(Math.min(220, width * 0.5));
  const side = (width - slot) / 2; // pad so the first and last garments can sit centred
  const offset = useSharedValue(0);
  const centred = useSharedValue(0);
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();

  const onCentre = (i: number) => {
    setActive(i);
    Haptics.selectionAsync().catch(() => {});
  };

  const onScroll = useAnimatedScrollHandler((e) => {
    offset.value = e.contentOffset.x;
    const i = snapIndex(e.contentOffset.x, slot, items.length);
    if (i !== centred.value) {
      centred.value = i;
      scheduleOnRN(onCentre, i);
    }
  });

  const item = items[active];
  if (!items.length) return null;
  return (
    <View accessibilityLabel="The Hanging Line">
      <View style={{ position: "absolute", left: 0, right: 0, top: 6, height: 1, backgroundColor: colors.forest, opacity: 0.7 }} />
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={slot}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: side, paddingBottom: 16 }}
      >
        {items.map((it, i) => (
          <Garment key={it.id} item={it} index={i} slot={slot} offset={offset} reduce={reduce} />
        ))}
      </Animated.ScrollView>
      {item && (
        <Pressable onPress={() => router.push(`/product/${item.slug}`)} accessibilityRole="link" className="mx-auto mt-2 w-64 items-center bg-canvas px-5 py-4" accessibilityLiveRegion="polite">
          <Text className={`px-1.5 py-0.5 font-sans-medium text-label uppercase ${item.mode === "UPCYCLED" ? "bg-tangerine text-forest" : "text-forest"}`}>
            {availabilityLabel(item) ?? (item.mode === "UPCYCLED" ? "One-of-a-kind" : "New")}
          </Text>
          <Text className="mt-2 text-center font-display text-display-sm text-forest">{item.name}</Text>
          <Price item={item} />
          <Text className="mt-3 border-b border-forest pb-0.5 font-sans-medium text-label uppercase text-forest">View details</Text>
        </Pressable>
      )}
    </View>
  );
}
