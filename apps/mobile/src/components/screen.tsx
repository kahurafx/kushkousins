import { ActivityIndicator, Text, View } from "react-native";
import { colors } from "@repo/ui";

export const Loading = () => (
  <View className="flex-1 items-center justify-center py-24">
    <ActivityIndicator color={colors.forest} />
  </View>
);

export const ErrorState = ({ message = "Couldn't reach kushkousins. Check your connection." }: { message?: string }) => (
  <View className="items-center px-8 py-24">
    <Text className="text-center font-sans text-body text-forest">{message}</Text>
  </View>
);

export const Wordmark = () => <Text className="text-center font-display text-display-md text-forest">kushkousins</Text>;
