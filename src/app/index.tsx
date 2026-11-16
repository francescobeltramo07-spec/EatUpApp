import React, { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { eatUpApi, type WeekProgramResponse } from "../services/eatup-api";

const features = [
  {
    title: "Ingredienti smart",
    description:
      "Seleziona quello che hai già in cucina e lascia che EatUp trovi idee utili.",
  },
  {
    title: "Ricette con AI",
    description:
      "Ottieni ricette divise tra immediate, con pochi extra e da spesa mirata.",
  },
  {
    title: "Programma settimanale",
    description:
      "Genera colazione, pranzo, merenda e cena partendo dai tuoi obiettivi.",
  },
];

const meals = [
  ["Colazione", "colazione"],
  ["Pranzo", "pranzo"],
  ["Merenda", "merenda"],
  ["Cena", "cena"],
] as const;

export default function Index() {
  const params = useLocalSearchParams();
  const signedIn = params.signedIn === "true";
  const [program, setProgram] = useState<WeekProgramResponse | null>(null);
  const [programLoading, setProgramLoading] = useState(true);
  const [programError, setProgramError] = useState(false);
  const [refreshNumber, setRefreshNumber] = useState(0);

  useEffect(() => {
    if (!signedIn) {
      return;
    }

    let active = true;

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

  function refreshProgram() {
    setProgram(null);
    setProgramError(false);
    setProgramLoading(true);
    setRefreshNumber((current) => current + 1);
  }

  const todayKey = getTodayDateKey();
  const todayProgram = Array.isArray(program?.days)
    ? program.days.find((day) => day.date === todayKey)
    : undefined;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroContent}>
            <Text style={styles.eyebrow}>Cucina intelligente</Text>
            <Text accessibilityRole="header" style={styles.title}>
              EatUp
            </Text>
            <Text style={styles.subtitle}>
              Organizza ingredienti, ricette e programma settimanale in un
              unico posto.
            </Text>
            <Text style={styles.copy}>
              Parti da quello che hai in casa, scopri ricette generate con l’AI
              e pianifica la settimana con pasti coerenti con i tuoi obiettivi
              nutrizionali.
            </Text>

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/login" as Href)}
                style={({ pressed }) => [
                  styles.primaryAction,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.primaryActionText}>Trova ricette</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/register" as Href)}
                style={({ pressed }) => [
                  styles.secondaryAction,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.secondaryActionText}>
                  Programma settimana
                </Text>
              </Pressable>
            </View>

            {!signedIn ? (
              <View style={styles.authActions}>
                <Text style={styles.authPrompt}>Hai già un account?</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push("/login" as Href)}
                >
                  <Text style={styles.authLink}>Accedi</Text>
                </Pressable>
                <Text style={styles.authPrompt}>·</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push("/register" as Href)}
                >
                  <Text style={styles.authLink}>Crea account</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.stats}>
              {[
                ["3", "tipi di ricette"],
                ["7", "giorni pianificati"],
                ["4", "pasti al giorno"],
              ].map(([value, label]) => (
                <View key={label} style={styles.statCard}>
                  <Text style={styles.statValue}>{value}</Text>
                  <Text style={styles.statLabel}>{label}</Text>
                </View>
              ))}
            </View>
          </View>

          {signedIn ? (
            <View
              accessibilityLabel="Programma alimentare di oggi"
              style={styles.todayCard}
            >
              <View style={styles.previewHeader}>
                <Text style={styles.previewEyebrow}>Oggi</Text>
                <Text style={styles.previewDate}>{todayKey}</Text>
              </View>
              {programLoading ? (
                <Text style={styles.stateText}>Caricamento programma…</Text>
              ) : programError ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  Programma non disponibile. Controlla la connessione e
                  riprova.
                </Text>
              ) : todayProgram ? (
                <View style={styles.mealList}>
                  {meals.map(([label, key]) => {
                    const meal = todayProgram[key];
                    return (
                      <View key={key} style={styles.mealCard}>
                        <Text style={styles.mealLabel}>{label}</Text>
                        <Text style={styles.mealValue}>
                          {typeof meal === "string" && meal.trim()
                            ? meal
                            : "Non indicato"}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.stateText}>
                  Nessun pasto programmato per oggi.
                </Text>
              )}
              <Pressable
                accessibilityLabel={
                  programError ? "Riprova programma" : "Aggiorna programma"
                }
                accessibilityRole="button"
                accessibilityState={{
                  disabled: programLoading,
                  busy: programLoading,
                }}
                disabled={programLoading}
                onPress={refreshProgram}
                style={styles.refreshButton}
              >
                <Text style={styles.refreshButtonText}>
                  {programError ? "Riprova" : "Aggiorna programma"}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.features}>
          {features.map((feature) => (
            <View key={feature.title} style={styles.featureCard}>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureDescription}>
                {feature.description}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
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
  safeArea: {
    flex: 1,
    backgroundColor: "#FFF7ED",
  },
  page: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 36,
    gap: 24,
  },
  hero: {
    gap: 24,
  },
  heroContent: {
    gap: 14,
  },
  eyebrow: {
    color: "#F97316",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: "#111827",
    fontSize: 68,
    fontWeight: "900",
    lineHeight: 72,
  },
  subtitle: {
    color: "#111827",
    fontSize: 23,
    fontWeight: "800",
    lineHeight: 29,
  },
  copy: {
    color: "#64748B",
    fontSize: 16,
    lineHeight: 26,
  },
  actions: {
    gap: 10,
    marginTop: 4,
  },
  primaryAction: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: "#F97316",
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryAction: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: "#111827",
  },
  secondaryActionText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.8,
  },
  authActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  authPrompt: {
    color: "#64748B",
    fontSize: 14,
  },
  authLink: {
    color: "#9A3412",
    fontSize: 14,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  stats: {
    flexDirection: "row",
    gap: 8,
  },
  statCard: {
    flex: 1,
    minHeight: 88,
    justifyContent: "center",
    gap: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  statValue: {
    color: "#F97316",
    fontSize: 27,
    fontWeight: "900",
    lineHeight: 30,
  },
  statLabel: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "700",
  },
  todayCard: {
    gap: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.96)",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 3,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewEyebrow: {
    color: "#F97316",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  previewDate: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "800",
  },
  mealList: {
    gap: 10,
  },
  mealCard: {
    gap: 5,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FED7AA",
    borderRadius: 10,
    backgroundColor: "#FFF7ED",
  },
  mealLabel: {
    color: "#F97316",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  mealValue: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
  },
  stateText: {
    color: "#64748B",
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    color: "#B91C1C",
    fontSize: 15,
    lineHeight: 22,
  },
  refreshButton: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 9,
    backgroundColor: "#111827",
  },
  refreshButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  features: {
    gap: 12,
  },
  featureCard: {
    gap: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.35)",
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  featureTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
  },
  featureDescription: {
    color: "#64748B",
    fontSize: 15,
    lineHeight: 24,
  },
});
