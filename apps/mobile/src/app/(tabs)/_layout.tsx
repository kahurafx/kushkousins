import { Tabs } from "expo-router";
import { Text, View, type ColorValue } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "@repo/ui";
import { BagIcon } from "@/components/product-card";
import { useCartCount } from "@/lib/cart";

const icon = (d: string, extra?: React.ReactNode) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={String(color)} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
        <Path d={d} />
        {extra}
      </Svg>
    );
  };

function BagTabIcon({ color }: { color: ColorValue }) {
  const count = useCartCount();
  return (
    <View>
      <BagIcon color={String(color)} size={22} />
      {count > 0 && (
        <View className="absolute -right-2 -top-1 h-4 min-w-4 items-center justify-center rounded-full bg-tangerine px-1">
          <Text className="font-sans-medium text-[10px] text-forest">{count}</Text>
        </View>
      )}
    </View>
  );
}

export default function TabLayout() {
  const count = useCartCount();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.forest,
        tabBarInactiveTintColor: `${colors.forest}80`,
        tabBarStyle: { backgroundColor: colors.canvas, borderTopColor: `${colors.forest}1A` },
        tabBarLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: icon("M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4z") }} />
      <Tabs.Screen name="shop" options={{ title: "Shop", tabBarIcon: icon("M4 6h16M4 12h16M4 18h10") }} />
      <Tabs.Screen name="upcycled" options={{ title: "Upcycled", tabBarIcon: icon("M12 3v4M12 7l-7 4h14z", <Path d="M5 11v8h14v-8" />) }} />
      <Tabs.Screen name="bag" options={{ title: "Bag", tabBarIcon: BagTabIcon, tabBarAccessibilityLabel: `Bag, ${count} ${count === 1 ? "item" : "items"}` }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: icon("M5 20c1.2-3.6 4-5.5 7-5.5s5.8 1.9 7 5.5", <Circle cx={12} cy={8.5} r={3.5} />) }} />
    </Tabs>
  );
}
