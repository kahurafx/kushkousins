import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ErrorState, Loading } from "@/components/screen";
import { StaggeredGrid } from "@/components/staggered-grid";
import { toShowcaseItem } from "@/lib/showcase";
import { useTRPC } from "@/lib/trpc";

const chips = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "streetwear", label: "Streetwear" },
  { id: "formal", label: "Formal" },
  { id: "outerwear", label: "Outerwear" },
];

/** Shop + Upcycled tabs: chips (shop only) above the 2-column staggered grid. */
export function Listing({ title, mode }: { title: string; mode?: "UPCYCLED" }) {
  const trpc = useTRPC();
  const [chip, setChip] = useState("all");
  const input =
    mode === "UPCYCLED" ? { mode } : chip === "new" ? { mode: "NEW" as const } : chip === "all" ? {} : { categorySlug: chip };
  const q = useQuery(trpc.product.list.queryOptions(input));

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-canvas">
      <ScrollView
        contentContainerClassName="pb-16"
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}
      >
        <Text className="px-4 pt-4 font-display text-display-lg text-forest">{title}</Text>
        {!mode && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-4 py-4">
            {chips.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setChip(c.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: chip === c.id }}
                className={`border px-3 py-2 ${chip === c.id ? "border-forest bg-forest" : "border-forest/25"}`}
              >
                <Text className={`font-sans-medium text-label uppercase ${chip === c.id ? "text-canvas" : "text-forest"}`}>{c.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        {mode && <Text className="px-4 pb-5 pt-1 font-sans text-body-sm text-forest/70">Every piece exists once. When it&apos;s gone, it&apos;s gone.</Text>}
        {q.isPending ? (
          <Loading />
        ) : q.isError ? (
          <ErrorState />
        ) : q.data.length === 0 ? (
          <ErrorState message="Nothing here yet." />
        ) : (
          <StaggeredGrid items={q.data.map(toShowcaseItem)} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
