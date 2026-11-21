import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { PressableScale } from "@/components/pressable-scale";
import { authClient } from "@/lib/auth-client";

const field = "mt-1 border border-forest/25 px-3 py-3 font-sans text-body text-forest";

/** Sign in / create account. `next` is an in-app route to continue to (e.g. /checkout). */
export default function Auth() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setError(null);
    setPending(true);
    const { error } =
      mode === "sign-up"
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });
    setPending(false);
    if (error) return setError(error.message ?? "Something went wrong. Please try again.");
    await queryClient.invalidateQueries(); // session changed: refetch anything user-specific
    router.back();
    if (next?.startsWith("/") && !next.startsWith("//")) router.push(next as never);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-canvas">
      <ScrollView contentContainerClassName="px-6 pb-12 pt-6" keyboardShouldPersistTaps="handled">
        <Text className="font-display text-display-lg text-forest">{mode === "sign-in" ? "Sign in" : "Create an account"}</Text>
        <View className="mt-8 gap-5">
          {mode === "sign-up" && (
            <View>
              <Text className="font-sans-medium text-label uppercase text-forest">Name</Text>
              <TextInput value={name} onChangeText={setName} autoComplete="name" textContentType="name" className={field} />
            </View>
          )}
          <View>
            <Text className="font-sans-medium text-label uppercase text-forest">Email</Text>
            <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" className={field} />
          </View>
          <View>
            <Text className="font-sans-medium text-label uppercase text-forest">Password</Text>
            <TextInput value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === "sign-up" ? "new-password" : "current-password"} className={field} />
            {mode === "sign-up" && <Text className="mt-1 font-sans text-body-sm text-forest/70">At least 8 characters.</Text>}
          </View>
          {error && (
            <Text accessibilityRole="alert" className="font-sans text-body-sm text-espresso">
              {error}
            </Text>
          )}
          <PressableScale onPress={submit} disabled={pending} accessibilityRole="button" className="items-center bg-forest py-4" style={{ opacity: pending ? 0.5 : 1 }}>
            <Text className="font-sans-medium text-label uppercase text-canvas">{pending ? "One moment…" : mode === "sign-in" ? "Sign in" : "Create account"}</Text>
          </PressableScale>
          <Pressable onPress={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")} accessibilityRole="button">
            <Text className="text-center font-sans text-body-sm text-forest underline">
              {mode === "sign-in" ? "New to kushkousins? Create an account" : "Already have an account? Sign in"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
