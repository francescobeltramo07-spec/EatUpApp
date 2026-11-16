import { useRef, useState } from "react";
import {
  Pressable,
  Text,
  TextInput,
  type TextInputInstance,
  View,
} from "react-native";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { AuthShell, authStyles } from "../components/auth-shell";
import {
  ApiConfigurationError,
  ApiRequestError,
  eatUpAuthApi,
} from "../services/eatup-api";
import React from "react";

export default function LoginScreen() {
  const params = useLocalSearchParams();
  const passwordInputRef = useRef<TextInputInstance>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const registrationComplete = params.registrationComplete === "true";

  async function submitLogin() {
    const normalizedUsername = username.trim();
    if (!normalizedUsername || !password) {
      setError("Inserisci nome utente e password.");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await eatUpAuthApi.login(normalizedUsername, password);
      router.replace("/?signedIn=true" as Href);
    } catch (requestError) {
      setError(
        requestError instanceof ApiConfigurationError
          ? "La connessione sicura al server non è configurata."
          : requestError instanceof ApiRequestError &&
              requestError.status === 401
            ? "Nome utente o password non corretti."
            : "Accesso non disponibile. Controlla la connessione e riprova.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Accedi"
      subtitle="Accedi al tuo account EatUp per continuare."
    >
      {registrationComplete ? (
        <Text accessibilityRole="alert" style={authStyles.notice}>
          Account creato. Accedi per continuare.
        </Text>
      ) : null}

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
          onSubmitEditing={submitLogin}
          ref={passwordInputRef}
          returnKeyType="go"
          secureTextEntry={!passwordVisible}
          style={authStyles.input}
          textContentType="password"
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
        accessibilityLabel="Invia accesso"
        accessibilityRole="button"
        accessibilityState={{ disabled: submitting, busy: submitting }}
        disabled={submitting}
        onPress={submitLogin}
        style={[
          authStyles.button,
          submitting ? authStyles.buttonDisabled : undefined,
        ]}
      >
        <Text style={authStyles.buttonText}>
          {submitting ? "Accesso in corso…" : "Accedi"}
        </Text>
      </Pressable>

      <View style={authStyles.inlineAction}>
        <Text>Non hai un account?</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/register" as Href)}
          style={authStyles.secondaryButton}
        >
          <Text style={authStyles.secondaryButtonText}>Crea account</Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}
