import { View, Text, Pressable, StyleSheet } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useThemePrefs } from "@/store/theme";
import { pressStyle } from "@/lib/pressFeedback";

export default function NotFoundScreen() {
  const { colors } = useThemePrefs();
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View style={[styles.wrap, { backgroundColor: colors.background }]}>
        <Text style={[styles.message, { color: colors.muted }]}>This screen does not exist.</Text>
        <Pressable
          onPress={() => router.replace("/home")}
          style={({ pressed }) => [pressStyle({ pressed }), styles.linkWrap]}
        >
          <Text style={[styles.link, { color: colors.primary }]}>Go to home</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  message: { fontSize: 18, textAlign: "center" },
  linkWrap: { marginTop: 16, paddingVertical: 8, paddingHorizontal: 12 },
  link: { fontSize: 16, fontWeight: "700" },
});
