import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { eatUpApi, type WeekProgramResponse } from "../services/eatup-api";
import React from "react";

export default function Index() {
  const params = useLocalSearchParams();
  const signedIn = params.signedIn === "true";
  const [count, setCount] = useState(0);
  const [program, setProgram] = useState<WeekProgramResponse | null>(null);
  const [programLoading, setProgramLoading] = useState(false);
  const [programError, setProgramError] = useState(false);
  const [refreshNumber, setRefreshNumber] = useState(0);

  useEffect(() => {
    if (!signedIn) {
      setProgram(null);
      setProgramLoading(false);
      setProgramError(false);
      return;
    }

    let active = true;
    setProgram(null);
    setProgramError(false);
    setProgramLoading(true);

    eatUpApi
      .getWeekProgram()
      .then((response) => {
        if (active) {
          setProgram(response);
        }
      })
      .catch(() => {
        if (active) {
          setProgram(null);
          setProgramError(true);
        }
      })
      .finally(() => {
        if (active) {
          setProgramLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [refreshNumber, signedIn]);

  const todayKey = getTodayDateKey();
  const todayProgram = Array.isArray(program?.days)
    ? program.days.find((day) => day.date === todayKey)
    : undefined;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ciao EatUp!</Text>
      <Text>Ingredienti scelti: {count}</Text>
      <Pressable style={styles.button} onPress={() => setCount(count + 1)}>
        <Text style={styles.buttonText}>Aggiungi ingrediente</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/login" as Href)}
        style={styles.authButton}
      >
        <Text style={styles.authButtonText}>Accedi</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/register" as Href)}
        style={styles.authButton}
      >
        <Text style={styles.authButtonText}>Crea account</Text>
      </Pressable>

      {signedIn ? (
        <View accessibilityLabel="Il programma di oggi" style={styles.program}>
          <Text style={styles.programTitle}>Il programma di oggi</Text>
          {programLoading ? (
            <Text accessibilityRole="text">Caricamento programma…</Text>
          ) : programError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              Programma non disponibile. Controlla la connessione e riprova.
            </Text>
          ) : todayProgram ? (
            <>
              {[
                ["Colazione", todayProgram.colazione],
                ["Pranzo", todayProgram.pranzo],
                ["Merenda", todayProgram.merenda],
                ["Cena", todayProgram.cena],
              ].map(([label, meal]) => (
                <Text key={label}>
                  {label}: {typeof meal === "string" && meal.trim() ? meal : "Non indicato"}
                </Text>
              ))}
            </>
          ) : (
            <Text>Nessun pasto programmato per oggi.</Text>
          )}
          <Pressable
            accessibilityLabel={programError ? "Riprova programma" : "Aggiorna programma"}
            accessibilityRole="button"
            accessibilityState={{ disabled: programLoading, busy: programLoading }}
            disabled={programLoading}
            onPress={() => setRefreshNumber((current) => current + 1)}
            style={styles.refreshButton}
          >
            <Text style={styles.refreshButtonText}>
              {programError ? "Riprova" : "Aggiorna programma"}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function getTodayDateKey(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  title: { fontSize: 28, fontWeight: "bold" },
  button: { backgroundColor: "#2e7d32", paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8 },
  buttonText: { color: "white", fontWeight: "600" },
  program: {
    width: "90%",
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#FFF7ED",
  },
  programTitle: { color: "#111827", fontSize: 18, fontWeight: "700" },
  error: { color: "#B91C1C" },
  refreshButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#C2410C",
  },
  refreshButtonText: { color: "#FFFFFF", fontWeight: "600" },
  authButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  authButtonText: {
    color: "#9A3412",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});