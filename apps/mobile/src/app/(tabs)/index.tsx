import { useQuery } from "@tanstack/react-query";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HangingLine } from "@/components/hanging-line";
import { ProductCard } from "@/components/product-card";
import { ErrorState, Loading, Wordmark } from "@/components/screen";
import { toShowcaseItem } from "@/lib/showcase";
import { useTRPC } from "@/lib/trpc";

export default function Home() {
  const trpc = useTRPC();
  const { width } = useWindowDimensions();
  const line = useQuery(trpc.product.hangingLine.queryOptions());
  const favs = useQuery(trpc.product.fanFavorites.queryOptions());

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-canvas">
      <ScrollView contentContainerClassName="pb-16">
        <View className="py-4">
          <Wordmark />
        </View>
        {line.isPending ? <Loading /> : line.isError ? <ErrorState /> : <HangingLine items={line.data.map(toShowcaseItem)} />}

        <View className="mt-12 px-4">
          <Text className="font-display text-display-lg text-forest">Fan Favorites</Text>
          <Text className="mt-1 font-sans text-body-sm text-forest/70">Fast movers and pieces on offer.</Text>
        </View>
        {favs.data && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={width * 0.6 + 16} decelerationRate="fast" contentContainerStyle={{ paddingHorizontal: 16, gap: 16, paddingTop: 20 }}>
            {favs.data.map((p) => (
              <ProductCard key={p.id} item={toShowcaseItem(p)} width={width * 0.6} />
            ))}
          </ScrollView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
