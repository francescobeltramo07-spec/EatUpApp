import { fireEvent, render } from "@testing-library/react-native";
import { describe, expect, it } from "@jest/globals";
import React from "react";
import { Pressable, Text } from "react-native";
import { AuthProvider, useAuth } from "../contexts/auth-context";

function AuthStateProbe() {
  const { signedIn, setSignedIn } = useAuth();

  return (
    <>
      <Text>{signedIn ? "Signed in" : "Signed out"}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => setSignedIn(true)}
      >
        <Text>Sign in</Text>
      </Pressable>
    </>
  );
}

describe("auth context", () => {
  it("shares sign-in state with screens inside its provider", async () => {
    const { getByRole, getByText } = await render(
      <AuthProvider>
        <AuthStateProbe />
      </AuthProvider>,
    );

    expect(getByText("Signed out")).toBeTruthy();
    await fireEvent.press(getByRole("button", { name: "Sign in" }));
    expect(getByText("Signed in")).toBeTruthy();
  });
});
