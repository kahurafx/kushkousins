import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { OrderStatus } from "@repo/types";
import { formatKES } from "@repo/ui";
import { PressableScale } from "@/components/pressable-scale";
import { Loading } from "@/components/screen";
import { authClient, useSession } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc";

const statusLabel: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function Profile() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session, isPending } = useSession();
  const orders = useQuery({ ...trpc.order.mine.queryOptions(), enabled: !!session });

  if (isPending) return <Loading />;
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-canvas">
      <ScrollView contentContainerClassName="px-4 pb-16 pt-4">
        {!session ? (
          <View className="pt-8">
            <Text className="font-display text-display-lg text-forest">Your account</Text>
            <Text className="mt-2 font-sans text-body text-forest/80">Sign in to check out, follow your orders and keep your details.</Text>
            <PressableScale onPress={() => router.push("/auth")} accessibilityRole="button" className="mt-8 items-center bg-forest py-4">
              <Text className="font-sans-medium text-label uppercase text-canvas">Sign in or create an account</Text>
            </PressableScale>
          </View>
        ) : (
          <>
            <Text className="font-sans-medium text-label uppercase text-forest/60">Your account</Text>
            <Text className="mt-1 font-display text-display-lg text-forest">Hello, {session.user.name.split(" ")[0]}</Text>
            <Text className="mt-8 font-sans-medium text-label uppercase text-forest">Orders</Text>
            {orders.isPending ? (
              <Loading />
            ) : !orders.data?.length ? (
              <Text className="mt-3 font-sans text-body text-forest/80">No orders yet.</Text>
            ) : (
              orders.data.map((o) => (
                <View key={o.id} className="mt-3 border border-forest/15 p-4">
                  <View className="flex-row justify-between">
                    <Text className="font-sans-medium text-body text-forest">#{o.id.slice(0, 8).toUpperCase()}</Text>
                    <Text className={`font-sans-medium text-label uppercase ${o.status === "pending_payment" ? "bg-tangerine px-1.5 text-forest" : "text-forest"}`}>{statusLabel[o.status]}</Text>
                  </View>
                  <Text className="mt-1 font-sans text-body-sm text-forest/70" numberOfLines={2}>
                    {o.items.map((i) => `${i.productName} ×${i.quantity}`).join(", ")}
                  </Text>
                  <Text className="mt-2 font-sans-medium text-price text-forest">{formatKES(o.totalCents)}</Text>
                </View>
              ))
            )}
            <Pressable
              className="mt-10"
              accessibilityRole="button"
              onPress={async () => {
                await authClient.signOut();
                queryClient.clear();
              }}
            >
              <Text className="font-sans-medium text-label uppercase text-forest underline">Sign out</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
