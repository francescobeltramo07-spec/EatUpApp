import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type AuthShellProps = PropsWithChildren<{
  title: string;
  subtitle: string;
}>;

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <SafeAreaView style={authStyles.safeArea}>
      <ScrollView
        contentContainerStyle={authStyles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={authStyles.card}>
          <Text accessibilityRole="header" style={authStyles.title}>
            {title}
          </Text>
          <Text style={authStyles.subtitle}>{subtitle}</Text>
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export const authStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFF7ED",
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    gap: 16,
    padding: 20,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
  },
  title: {
    color: "#111827",
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    color: "#475569",
    fontSize: 16,
    lineHeight: 23,
  },
  label: {
    color: "#1F2937",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    minHeight: 48,
    borderColor: "#94A3B8",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: "#111827",
    backgroundColor: "#FFFFFF",
    fontSize: 16,
  },
  field: {
    gap: 2,
  },
  button: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#C2410C",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: "#9A3412",
    fontSize: 16,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  feedback: {
    color: "#B91C1C",
    fontSize: 15,
    lineHeight: 21,
  },
  notice: {
    color: "#166534",
    fontSize: 15,
    lineHeight: 21,
  },
  inlineAction: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
});
