import { useRef, useState } from "react";
import {
  Pressable,
  Text,
  TextInput,
  type TextInputInstance,
  View,
} from "react-native";
import { router, type Href } from "expo-router";
import { AuthShell, authStyles } from "../components/auth-shell";
import {
  ApiConfigurationError,
  ApiRequestError,
  eatUpAuthApi,
} from "../services/eatup-api";
import React from "react";

export default function RegisterScreen() {
  const passwordInputRef = useRef<TextInputInstance>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submitRegistration() {
    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password) {
      setError("Inserisci nome utente e password.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await eatUpAuthApi.register(normalizedUsername, password);
      const loginUrl = "/login?registrationComplete=true" as Href;
      router.replace(loginUrl);
    } catch (requestError) {
      setError(
        requestError instanceof ApiConfigurationError
          ? "La connessione sicura al server non è configurata."
          : requestError instanceof ApiRequestError &&
              requestError.status === 401
            ? "Questo nome utente è già registrato."
            : "Registrazione non disponibile. Controlla la connessione e riprova.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Crea account"
      subtitle="Crea il tuo account EatUp. Dopo la registrazione dovrai accedere."
    >
      <View style={authStyles.field}>
        <Text style={authStyles.label}>Nome utente</Text>
        <TextInput
          accessibilityLabel="Nome utente"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!submitting}
          onChangeText={setUsername}
          onSubmitEditing={() =>
            TextInput.State.focusTextInput(
              passwordInputRef.current?.getNativeRef(),
            )
          }
          returnKeyType="next"
          style={authStyles.input}
          textContentType="username"
          value={username}
        />
      </View>

      <View style={authStyles.field}>
        <Text style={authStyles.label}>Password</Text>
        <TextInput
          accessibilityLabel="Password"
          autoCapitalize="none"
          editable={!submitting}
          onChangeText={setPassword}
          onSubmitEditing={submitRegistration}
          ref={passwordInputRef}
          returnKeyType="done"
          secureTextEntry={!passwordVisible}
          style={authStyles.input}
          textContentType="newPassword"
          value={password}
        />
        <Pressable
          accessibilityLabel={
            passwordVisible ? "Nascondi password" : "Mostra password"
          }
          accessibilityRole="button"
          onPress={() => setPasswordVisible((visible) => !visible)}
          style={authStyles.secondaryButton}
        >
          <Text style={authStyles.secondaryButtonText}>
            {passwordVisible ? "Nascondi password" : "Mostra password"}
          </Text>
        </Pressable>
      </View>

      {error ? (
        <Text accessibilityRole="alert" style={authStyles.feedback}>
          {error}
        </Text>
      ) : null}

      <Pressable
        accessibilityLabel="Invia registrazione"
        accessibilityRole="button"
        accessibilityState={{ disabled: submitting, busy: submitting }}
        disabled={submitting}
        onPress={submitRegistration}
        style={[
          authStyles.button,
          submitting ? authStyles.buttonDisabled : undefined,
        ]}
      >
        <Text style={authStyles.buttonText}>
          {submitting ? "Registrazione in corso…" : "Crea account"}
        </Text>
      </Pressable>

      <View style={authStyles.inlineAction}>
        <Text>Hai già un account?</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace("/login" as Href)}
          style={authStyles.secondaryButton}
        >
          <Text style={authStyles.secondaryButtonText}>Accedi</Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}
