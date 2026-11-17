import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, type Href } from "expo-router";
import { useAuth } from "../../contexts/auth-context";
import type {
  WeekProgramDay,
  WeekProgramPreferences,
  WeekProgramResponse,
} from "../../services/eatup-api";
import { eatUpApi } from "../../services/eatup-api";

type MealKey = "colazione" | "pranzo" | "merenda" | "cena";

type ProgramDay = {
  giorno: string;
  date: string;
  colazione: string;
  pranzo: string;
  merenda: string;
  cena: string;
};

const meals: { key: MealKey; label: string }[] = [
  { key: "colazione", label: "Colazione" },
  { key: "pranzo", label: "Pranzo" },
  { key: "merenda", label: "Merenda" },
  { key: "cena", label: "Cena" },
];

const dayNames = [
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
  "Domenica",
];

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function parseProgram(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") {
    return asRecord(value);
  }

  try {
    return asRecord(JSON.parse(value) as unknown);
  } catch {
    return {};
  }
}

function mealText(value: unknown): string {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }

  const meal = asRecord(value);
  const name = meal.nome ?? meal.name ?? meal.piatto ?? meal.title;
  const portion = meal.porzione ?? meal.portion ?? meal.quantita ?? meal.quantity;
  const calories = meal.calorie ?? meal.kcal;
  const details = [
    portion,
    calories ? `${String(calories)} kcal` : "",
  ].filter(Boolean);
  return [name, details.length > 0 ? details.join(" - ") : ""]
    .filter(Boolean)
    .map(String)
    .join(" | ");
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeProgram(value: WeekProgramResponse): ProgramDay[] {
  const parsed = parseProgram(value);
  const source =
    parsed.days ?? parsed.weekProgram ?? parsed.programma ?? parsed.program;
  if (!Array.isArray(source)) {
    return [];
  }

  return source.map((rawDay: unknown, index: number) => {
    const day = asRecord(rawDay) as WeekProgramDay & Record<string, unknown>;
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + index);
    return {
      giorno:
        String(day.giorno ?? day.day ?? dayNames[index] ?? `Giorno ${index + 1}`),
      date: String(day.date ?? day.data ?? dateKey(defaultDate)),
      colazione: mealText(day.colazione ?? day.breakfast),
      pranzo: mealText(day.pranzo ?? day.lunch),
      merenda: mealText(day.merenda ?? day.snack),
      cena: mealText(day.cena ?? day.dinner),
    };
  });
}

function inputValue(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function optionalNumber(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

export default function WeekProgramScreen() {
  const { signedIn } = useAuth();
  const [calorie, setCalorie] = useState("");
  const [proteine, setProteine] = useState("");
  const [carboidrati, setCarboidrati] = useState("");
  const [grassi, setGrassi] = useState("");
  const [fibre, setFibre] = useState("");
  const [preferenze, setPreferenze] = useState("");
  const [intolleranze, setIntolleranze] = useState("");
  const [program, setProgram] = useState<ProgramDay[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loadingSavedProgram, setLoadingSavedProgram] = useState(signedIn);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!signedIn) {
      return;
    }

    let active = true;
    eatUpApi
      .getWeekProgram()
      .then((response) => {
        if (!active) {
          return;
        }

        const parsed = parseProgram(response);
        const days = normalizeProgram(response);
        const preferences =
          parsed.preferences !== null &&
          typeof parsed.preferences === "object"
            ? (parsed.preferences as WeekProgramPreferences)
            : {};

        setProgram(days);
        setStartDate(
          String(parsed.startDate ?? days[0]?.date ?? ""),
        );
        setEndDate(
          String(parsed.endDate ?? days[days.length - 1]?.date ?? ""),
        );
        setCalorie(inputValue(preferences.calorie));
        setProteine(inputValue(preferences.proteine));
        setCarboidrati(inputValue(preferences.carboidrati));
        setGrassi(inputValue(preferences.grassi));
        setFibre(inputValue(preferences.fibre));
        setPreferenze(preferences.preferenze ?? "");
        setIntolleranze(preferences.intolleranze ?? "");
      })
      .catch(() => {
        if (active) {
          setError("Non sono riuscito a caricare il programma salvato.");
        }
      })
      .finally(() => {
        if (active) {
          setLoadingSavedProgram(false);
        }
      });

    return () => {
      active = false;
    };
  }, [signedIn]);

  const todayProgram = useMemo(
    () => program.find((day) => day.date === dateKey(new Date())),
    [program],
  );

  async function submitProgram() {
    setError("");

    const dailyCalories = Number(calorie);
    if (!Number.isFinite(dailyCalories) || dailyCalories <= 0) {
      setError("Inserisci un numero di calorie maggiore di zero.");
      return;
    }

    const optionalValues = [proteine, carboidrati, grassi, fibre];
    if (
      optionalValues.some(
        (value) => value.trim() !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0),
      )
    ) {
      setError("I valori nutrizionali facoltativi non possono essere negativi.");
      return;
    }

    if (!signedIn) {
      setError("Devi effettuare il login per generare il programma.");
      return;
    }

    const preferences: WeekProgramPreferences = {
      calorie: dailyCalories,
      proteine: optionalNumber(proteine),
      carboidrati: optionalNumber(carboidrati),
      grassi: optionalNumber(grassi),
      fibre: optionalNumber(fibre),
      preferenze: preferenze.trim(),
      intolleranze: intolleranze.trim(),
    };

    setGenerating(true);
    try {
      const response = await eatUpApi.generateWeekProgram(preferences);
      const days = normalizeProgram(response);
      setProgram(days);
      setStartDate(String(response.startDate ?? days[0]?.date ?? ""));
      setEndDate(
        String(response.endDate ?? days[days.length - 1]?.date ?? ""),
      );
      if (days.length === 0) {
        setError(
          "La risposta ricevuta non contiene un programma settimanale valido.",
        );
      }
    } catch {
      setError("Non sono riuscito a generare il programma. Riprova tra poco.");
    } finally {
      setGenerating(false);
    }
  }

  if (!signedIn) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loginRequired}>
          <Text style={styles.eyebrow}>Accesso richiesto</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Devi effettuare il login per usare il programma settimanale.
          </Text>
          <Text style={styles.bodyText}>
            Questa funzione genera un calendario alimentare personale, quindi
            accedi prima al tuo account EatUp.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/login" as Href)}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Vai al login</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        

        <View style={styles.panel}>
          <Text style={styles.eyebrow}>AI meal planner</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Programma settimanale
          </Text>
          <Text style={styles.bodyText}>
            Inserisci gli obiettivi nutrizionali. Il programma viene salvato nel
            tuo account e puoi cambiarlo generandone uno nuovo.
          </Text>

          <NumberField
            accessibilityLabel="Calorie giornaliere"
            label="Calorie giornaliere *"
            onChangeText={setCalorie}
            value={calorie}
          />
          {error === "Inserisci un numero di calorie maggiore di zero." ? (
            <Text style={styles.fieldError}>{error}</Text>
          ) : null}
          <View style={styles.macroGrid}>
            <NumberField
              accessibilityLabel="Proteine (g)"
              label="Proteine (g)"
              onChangeText={setProteine}
              value={proteine}
            />
            <NumberField
              accessibilityLabel="Carboidrati (g)"
              label="Carboidrati (g)"
              onChangeText={setCarboidrati}
              value={carboidrati}
            />
            <NumberField
              accessibilityLabel="Grassi (g)"
              label="Grassi (g)"
              onChangeText={setGrassi}
              value={grassi}
            />
            <NumberField
              accessibilityLabel="Fibre (g)"
              label="Fibre (g)"
              onChangeText={setFibre}
              value={fibre}
            />
          </View>
          <TextField
            accessibilityLabel="Preferenze alimentari"
            label="Preferenze alimentari"
            onChangeText={setPreferenze}
            placeholder="Es. mediterranea, vegetariana, pasti veloci"
            value={preferenze}
          />
          <TextField
            accessibilityLabel="Intolleranze"
            label="Intolleranze o ingredienti da evitare"
            onChangeText={setIntolleranze}
            placeholder="Es. lattosio, frutta secca, glutine"
            value={intolleranze}
          />

          {error &&
          error !== "Inserisci un numero di calorie maggiore di zero." ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <Pressable
            accessibilityLabel={
              program.length > 0
                ? "Cambia programma settimanale"
                : "Genera programma"
            }
            accessibilityRole="button"
            accessibilityState={{ disabled: generating, busy: generating }}
            disabled={generating}
            onPress={submitProgram}
            style={[styles.primaryButton, generating && styles.buttonDisabled]}
          >
            <Text style={styles.primaryButtonText}>
              {generating
                ? "Generazione in corso..."
                : program.length > 0
                  ? "Cambia programma settimanale"
                  : "Genera programma"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.calendar}>
          <Text style={styles.eyebrow}>Calendario</Text>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Colazione, pranzo, merenda e cena
          </Text>
          {startDate && endDate ? (
            <Text style={styles.bodyText}>
              Dal {startDate} al {endDate}
            </Text>
          ) : null}

          {loadingSavedProgram ? (
            <Text style={styles.bodyText}>Caricamento del programma salvato...</Text>
          ) : program.length === 0 ? (
            <Text style={styles.emptyText}>
              Compila il modulo per vedere qui il programma generato dall&apos;AI.
            </Text>
          ) : (
            <>
              {todayProgram ? (
                <View style={styles.todayCard}>
                  <Text style={styles.eyebrow}>Oggi · {todayProgram.date}</Text>
                  {meals.map((meal) => (
                    <MealRow
                      key={meal.key}
                      label={meal.label}
                      value={todayProgram[meal.key]}
                    />
                  ))}
                </View>
              ) : (
                <View style={styles.todayCard}>
                  <Text style={styles.eyebrow}>Oggi</Text>
                  <Text style={styles.bodyText}>
                    Il programma salvato non contiene pasti per oggi.
                  </Text>
                </View>
              )}
              <View style={styles.days}>
                {program.map((day) => (
                  <View key={day.date} style={styles.dayCard}>
                    <Text style={styles.dayTitle}>{day.date || day.giorno}</Text>
                    {meals.map((meal) => (
                      <MealRow
                        key={meal.key}
                        label={meal.label}
                        value={day[meal.key]}
                      />
                    ))}
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type FieldProps = {
  accessibilityLabel: string;
  label: string;
  onChangeText: (value: string) => void;
  value: string;
  placeholder?: string;
};

function NumberField({
  accessibilityLabel,
  label,
  onChangeText,
  value,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        keyboardType="numeric"
        onChangeText={onChangeText}
        placeholder={label.includes("Calorie") ? "Es. 2200" : ""}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function TextField({
  accessibilityLabel,
  label,
  onChangeText,
  placeholder,
  value,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        multiline
        onChangeText={onChangeText}
        placeholder={placeholder}
        style={[styles.input, styles.multiline]}
        value={value}
      />
    </View>
  );
}

function MealRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.mealRow}>
      <Text style={styles.mealLabel}>{label}</Text>
      <Text style={styles.mealValue}>{value || "Non indicato"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFF7ED",
  },
  page: {
    gap: 18,
    padding: 18,
    paddingBottom: 36,
  },
  homeLink: {
    alignSelf: "flex-start",
    paddingVertical: 6,
  },
  homeLinkText: {
    color: "#9A3412",
    fontSize: 15,
    fontWeight: "700",
  },
  panel: {
    gap: 13,
    padding: 17,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  eyebrow: {
    color: "#F97316",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    color: "#111827",
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 33,
  },
  bodyText: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 21,
  },
  field: {
    flex: 1,
    gap: 6,
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
  },
  input: {
    minHeight: 44,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  multiline: {
    minHeight: 78,
    paddingTop: 10,
    textAlignVertical: "top",
  },
  macroGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  fieldError: {
    color: "#B91C1C",
    fontSize: 13,
  },
  error: {
    padding: 11,
    borderRadius: 8,
    color: "#991B1B",
    backgroundColor: "#FEE2E2",
  },
  primaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 9,
    backgroundColor: "#F97316",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  calendar: {
    gap: 12,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 19,
    fontWeight: "900",
  },
  emptyText: {
    padding: 16,
    borderRadius: 10,
    color: "#64748B",
    lineHeight: 22,
    backgroundColor: "#FFFFFF",
  },
  todayCard: {
    gap: 10,
    padding: 15,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
  },
  days: {
    gap: 12,
  },
  dayCard: {
    gap: 9,
    padding: 15,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
  },
  dayTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
  },
  mealRow: {
    gap: 3,
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E2E8F0",
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
    fontSize: 14,
    lineHeight: 20,
  },
  loginRequired: {
    flex: 1,
    justifyContent: "center",
    gap: 14,
    padding: 22,
  },
});
