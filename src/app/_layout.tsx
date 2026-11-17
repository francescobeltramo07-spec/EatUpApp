import { Stack } from "expo-router";
import React from "react";
import { AuthProvider } from "../contexts/auth-context";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
