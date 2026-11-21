import { Text, View } from "react-native";
import { formatKES } from "@repo/ui";

export function Price({ item, large = false }: { item: { priceCents: number; salePriceCents: number }; large?: boolean }) {
  const discounted = item.salePriceCents < item.priceCents;
  const text = large ? "text-body" : "text-price";
  return (
    <View
      className="flex-row items-baseline gap-2"
      accessible
      accessibilityLabel={discounted ? `Was ${formatKES(item.priceCents)}, now ${formatKES(item.salePriceCents)}` : formatKES(item.salePriceCents)}
    >
      {discounted && <Text className={`${text} font-sans text-forest/60 line-through`}>{formatKES(item.priceCents)}</Text>}
      <Text className={`${text} font-sans-medium text-forest`}>{formatKES(item.salePriceCents)}</Text>
    </View>
  );
}
