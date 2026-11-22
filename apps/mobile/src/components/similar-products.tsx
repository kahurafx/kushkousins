import { useQuery } from "@tanstack/react-query";
import { Text, View } from "react-native";
import { toShowcaseItem } from "@/lib/showcase";
import { useTRPC } from "@/lib/trpc";
import { StaggeredGrid } from "./staggered-grid";

/** "You may also like" rail. Silent while loading or on error: it must never get in the way of buying. */
export function SimilarProducts({ productId }: { productId: string }) {
  const trpc = useTRPC();
  const q = useQuery(trpc.product.similar.queryOptions({ productId }));
  if (!q.data?.length) return null;

  return (
    <View className="mt-12">
      <Text accessibilityRole="header" className="px-4 font-display text-display-md text-forest">You may also like</Text>
      <View className="mt-6">
        <StaggeredGrid items={q.data.map(toShowcaseItem)} />
      </View>
    </View>
  );
}
