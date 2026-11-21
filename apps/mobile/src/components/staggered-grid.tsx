import { useWindowDimensions, View } from "react-native";
import type { ShowcaseItem } from "@/lib/showcase";
import { ProductCard } from "./product-card";

const GUTTER = 16;
const GAP = 12;

/** 2-column staggered grid: alternating tall/short cards, right column offset down. */
export function StaggeredGrid({ items }: { items: ShowcaseItem[] }) {
  const { width } = useWindowDimensions();
  const col = (width - GUTTER * 2 - GAP) / 2;
  const columns = [items.filter((_, i) => i % 2 === 0), items.filter((_, i) => i % 2 === 1)];
  return (
    <View className="flex-row" style={{ paddingHorizontal: GUTTER, gap: GAP }}>
      {columns.map((list, c) => (
        <View key={c} style={{ width: col, gap: 28, paddingTop: c === 1 ? 48 : 0 }}>
          {list.map((item, i) => (
            <ProductCard key={item.id} item={item} width={col} tall={(i + c) % 2 === 0} />
          ))}
        </View>
      ))}
    </View>
  );
}
