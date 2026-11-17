import React, { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, type Href } from "expo-router";
import { useAuth } from "../../contexts/auth-context";
import {
  IngredientPicker,
  getIngredientName,
} from "../../components/ingredient-picker";
import type {
  Ingredient,
  IngredientCategory,
  ShoppingListCategory,
  ShoppingListResponse,
  ShoppingListSourceSelection,
} from "../../services/eatup-api";
import { eatUpApi } from "../../services/eatup-api";

type ShoppingItem = {
  nome: string;
  quantita: string;
  motivo: string;
  checked: boolean;
};

type ShoppingCategory = {
  categoria: string;
  items: ShoppingItem[];
  open: boolean;
};

type Sources = {
  weekProgram: boolean;
  recipes: boolean;
};

type ShoppingSourceChoice = "weekProgram" | "recipes" | "both";

const shoppingSourceOptions: {
  value: ShoppingSourceChoice;
  label: string;
  description: string;
}[] = [
  {
    value: "weekProgram",
    label: "Piano settimanale",
    description: "Usa solo i pasti del piano",
  },
  {
    value: "recipes",
    label: "Ricette generate",
    description: "Usa solo le ricette salvate",
  },
  {
    value: "both",
    label: "Entrambi",
    description: "Combina piano e ricette",
  },
];

function getSourceSelection(choice: ShoppingSourceChoice): ShoppingListSourceSelection {
  return {
    weekProgram: choice === "weekProgram" || choice === "both",
    recipes: choice === "recipes" || choice === "both",
  };
}

function getSourceChoice(sources: Sources): ShoppingSourceChoice | null {
  if (sources.weekProgram && sources.recipes) {
    return "both";
  }
  if (sources.weekProgram) {
    return "weekProgram";
  }
  if (sources.recipes) {
    return "recipes";
  }
  return null;
}

function normalizeShoppingList(
  response: ShoppingListResponse,
): ShoppingCategory[] {
  const categories: ShoppingListCategory[] = Array.isArray(response.categories)
    ? response.categories
    : [];
  return categories
    .map((category) => ({
      categoria: category.categoria ?? category.category ?? "Altro",
      open: true,
      items: (Array.isArray(category.items) ? category.items : [])
        .map((item) => ({
          nome: item.nome ?? item.name ?? "",
          quantita: item.quantita ?? item.quantity ?? "q.b.",
          motivo: item.motivo ?? item.reason ?? "",
          checked: false,
        }))
        .filter((item) => item.nome.trim().length > 0),
    }))
    .filter((category) => category.items.length > 0);
}

function getSources(response: ShoppingListResponse): Sources {
  return {
    weekProgram: Boolean(response.sources?.weekProgram),
    recipes: Boolean(response.sources?.recipes),
  };
}

export default function ShoppingListScreen() {
  const { signedIn } = useAuth();
  const [categories, setCategories] = useState<IngredientCategory[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<Ingredient[]>(
    [],
  );
  const [shoppingCategories, setShoppingCategories] = useState<
    ShoppingCategory[]
  >([]);
  const [sources, setSources] = useState<Sources>({
    weekProgram: false,
    recipes: false,
  });
  const [sourceChoice, setSourceChoice] = useState<ShoppingSourceChoice>("both");
  const [ingredientPickerExpanded, setIngredientPickerExpanded] = useState(true);
  const [loadingIngredients, setLoadingIngredients] = useState(signedIn);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!signedIn) {
      return;
    }

    let active = true;
    eatUpApi
      .getIngredients()
      .then((response) => {
        if (!active) {
          return;
        }
        setCategories(
          Array.isArray(response) ? response : (response.categories ?? []),
        );
      })
      .catch(() => {
        if (active) {
          setCategories([]);
          setError("Non sono riuscito a caricare gli ingredienti.");
        }
      })
      .finally(() => {
        if (active) {
          setLoadingIngredients(false);
        }
      });

    return () => {
      active = false;
    };
  }, [signedIn]);

  useEffect(() => {
    if (!signedIn) {
      return;
    }

    let active = true;
    eatUpApi
      .getShoppingList()
      .then((response) => {
        if (active) {
          const savedCategories = normalizeShoppingList(response);
          setShoppingCategories(savedCategories);
          if (savedCategories.length > 0) {
            setIngredientPickerExpanded(false);
          }
          const savedSources = getSources(response);
          setSources(savedSources);
          const savedChoice = getSourceChoice(savedSources);
          if (savedChoice) {
            setSourceChoice(savedChoice);
          }
        }
      })
      .catch(() => {
        if (active) {
          setError("Non sono riuscito a caricare la lista salvata.");
        }
      });

    return () => {
      active = false;
    };
  }, [signedIn]);

  const totalItems = useMemo(
    () =>
      shoppingCategories.reduce(
        (total, category) => total + category.items.length,
        0,
      ),
    [shoppingCategories],
  );
  const checkedItems = useMemo(
    () =>
      shoppingCategories.reduce(
        (total, category) =>
          total + category.items.filter((item) => item.checked).length,
        0,
      ),
    [shoppingCategories],
  );

  function updateItem(
    categoryIndex: number,
    itemIndex: number,
    checked: boolean,
  ) {
    setShoppingCategories((current) =>
      current.map((category, currentCategoryIndex) =>
        currentCategoryIndex !== categoryIndex
          ? category
          : {
              ...category,
              items: category.items.map((item, currentItemIndex) =>
                currentItemIndex === itemIndex ? { ...item, checked } : item,
              ),
            },
      ),
    );
  }

  function setAllChecked(checked: boolean) {
    setShoppingCategories((current) =>
      current.map((category) => ({
        ...category,
        items: category.items.map((item) => ({ ...item, checked })),
      })),
    );
  }

  function toggleCategory(categoryIndex: number) {
    setShoppingCategories((current) =>
      current.map((category, index) =>
        index === categoryIndex ? { ...category, open: !category.open } : category,
      ),
    );
  }

  async function generateList() {
    setError("");
    if (!signedIn) {
      setError("Devi effettuare il login per generare la lista della spesa.");
      return;
    }

    setGenerating(true);
    try {
      const response = await eatUpApi.generateShoppingList(
        selectedIngredients.map(getIngredientName),
        getSourceSelection(sourceChoice),
      );
      const nextCategories = normalizeShoppingList(response);
      const nextSources = getSources(response);
      setShoppingCategories(nextCategories);
      setSources(nextSources);
      setIngredientPickerExpanded(false);

      if (!nextSources.weekProgram && !nextSources.recipes) {
        setError(
          sourceChoice === "weekProgram"
            ? "Genera prima un programma settimanale."
            : sourceChoice === "recipes"
              ? "Genera prima alcune ricette."
              : "Genera prima ricette o un programma settimanale.",
        );
      }
    } catch {
      setError(
        "Non sono riuscito a generare la lista della spesa. Riprova tra poco.",
      );
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
            Lista della spesa automatica
          </Text>
          <Text style={styles.bodyText}>
            Accedi per combinare le ricette e il programma settimanale nel tuo
            account EatUp.
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
        

        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>Spesa smart</Text>
            <Text accessibilityRole="header" style={styles.title}>
              Lista della spesa automatica
            </Text>
          </View>
        </View>

        <View style={styles.sourceSelector}>
          <Text style={styles.sectionTitle}>Cosa vuoi includere?</Text>
          <Text style={styles.bodyText}>
            Scegli le fonti da usare per creare questa lista.
          </Text>
          <View style={styles.sourceOptions}>
            {shoppingSourceOptions.map((option) => {
              const selected = sourceChoice === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  disabled={generating}
                  onPress={() => setSourceChoice(option.value)}
                  style={[
                    styles.sourceOption,
                    selected && styles.sourceOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.sourceOptionTitle,
                      selected && styles.sourceOptionTitleSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text style={styles.sourceOptionDescription}>
                    {option.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          accessibilityLabel="Genera lista"
          accessibilityRole="button"
          accessibilityState={{ disabled: generating, busy: generating }}
          disabled={generating}
          onPress={generateList}
          style={[styles.primaryButton, generating && styles.buttonDisabled]}
        >
          <Text style={styles.primaryButtonText}>
            {generating ? "Generazione in corso..." : "Genera lista"}
          </Text>
        </Pressable>

        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <IngredientPicker
          categories={categories}
          loading={loadingIngredients}
          onPanelExpandedChange={setIngredientPickerExpanded}
          onSelectionChange={setSelectedIngredients}
          panelExpanded={ingredientPickerExpanded}
          selectedIngredients={selectedIngredients}
        />

        <View style={styles.summary}>
          <View style={styles.summaryText}>
            <Text style={styles.eyebrow}>Totale</Text>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {totalItems} ingredienti mancanti
            </Text>
            <Text style={styles.bodyText}>
              {checkedItems} spuntati
            </Text>
          </View>
          <View style={styles.sourcePills}>
            <Text
              style={[
                styles.sourcePill,
                sources.recipes && styles.sourcePillActive,
              ]}
            >
              Ricette
            </Text>
            <Text
              style={[
                styles.sourcePill,
                sources.weekProgram && styles.sourcePillActive,
              ]}
            >
              Programma
            </Text>
          </View>
        </View>

        {totalItems === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.sectionTitle}>La lista apparirà qui</Text>
            <Text style={styles.bodyText}>
              Genera almeno una ricetta o un programma settimanale, poi crea la
              spesa automatica.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.listActions}>
              <Pressable
                accessibilityLabel="Spunta tutto"
                accessibilityRole="button"
                onPress={() => setAllChecked(true)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Spunta tutto</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Ripristina"
                accessibilityRole="button"
                onPress={() => setAllChecked(false)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Ripristina</Text>
              </Pressable>
            </View>
            <View style={styles.categories}>
              {shoppingCategories.map((category, categoryIndex) => (
                <View key={`${category.categoria}-${categoryIndex}`} style={styles.category}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: category.open }}
                    onPress={() => toggleCategory(categoryIndex)}
                    style={styles.categoryButton}
                  >
                    <Text style={styles.categoryTitle}>{category.categoria}</Text>
                    <Text style={styles.categoryMeta}>
                      {category.items.length} {category.open ? "⌄" : "›"}
                    </Text>
                  </Pressable>
                  {category.open ? (
                    <View style={styles.items}>
                      {category.items.map((item, itemIndex) => (
                        <Pressable
                          accessibilityLabel={`${item.checked ? "Rimuovi spunta" : "Spunta"} ${item.nome}`}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: item.checked }}
                          key={`${item.nome}-${itemIndex}`}
                          onPress={() =>
                            updateItem(
                              categoryIndex,
                              itemIndex,
                              !item.checked,
                            )
                          }
                          style={[
                            styles.item,
                            item.checked && styles.itemChecked,
                          ]}
                        >
                          <Text style={styles.checkbox}>
                            {item.checked ? "✓" : "○"}
                          </Text>
                          <View style={styles.itemMain}>
                            <Text
                              style={[
                                styles.itemName,
                                item.checked && styles.itemNameChecked,
                              ]}
                            >
                              {item.nome}
                            </Text>
                            <Text style={styles.itemReason}>{item.motivo}</Text>
                          </View>
                          <Text style={styles.quantity}>{item.quantita}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFF7ED",
  },
  page: {
    gap: 16,
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
  header: {
    gap: 12,
  },
  headerText: {
    gap: 6,
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
    fontSize: 25,
    fontWeight: "900",
    lineHeight: 32,
  },
  primaryButton: {
    minHeight: 47,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
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
  error: {
    padding: 11,
    borderRadius: 8,
    color: "#991B1B",
    backgroundColor: "#FEE2E2",
  },
  summary: {
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  sourceSelector: {
    gap: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  sourceOptions: {
    gap: 8,
    marginTop: 4,
  },
  sourceOption: {
    gap: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
  },
  sourceOptionSelected: {
    borderColor: "#F97316",
    backgroundColor: "#FFF7ED",
  },
  sourceOptionTitle: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "800",
  },
  sourceOptionTitleSelected: {
    color: "#9A3412",
  },
  sourceOptionDescription: {
    color: "#64748B",
    fontSize: 12,
  },
  summaryText: {
    gap: 5,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 19,
    fontWeight: "900",
  },
  bodyText: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 21,
  },
  sourcePills: {
    flexDirection: "row",
    gap: 8,
  },
  sourcePill: {
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    color: "#64748B",
    backgroundColor: "#F1F5F9",
  },
  sourcePillActive: {
    color: "#9A3412",
    backgroundColor: "#FFEDD5",
  },
  emptyCard: {
    gap: 8,
    padding: 16,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
  },
  listActions: {
    flexDirection: "row",
    gap: 9,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 43,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
  },
  secondaryButtonText: {
    color: "#334155",
    fontWeight: "700",
  },
  categories: {
    gap: 10,
  },
  category: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  categoryButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    backgroundColor: "#FFFFFF",
  },
  categoryTitle: {
    color: "#111827",
    fontWeight: "800",
  },
  categoryMeta: {
    color: "#64748B",
  },
  items: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  item: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E2E8F0",
  },
  itemChecked: {
    opacity: 0.62,
  },
  checkbox: {
    width: 20,
    color: "#F97316",
    fontSize: 18,
    fontWeight: "800",
  },
  itemMain: {
    flex: 1,
    gap: 3,
  },
  itemName: {
    color: "#111827",
    fontWeight: "700",
  },
  itemNameChecked: {
    textDecorationLine: "line-through",
  },
  itemReason: {
    color: "#64748B",
    fontSize: 12,
  },
  quantity: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "700",
  },
  loginRequired: {
    flex: 1,
    justifyContent: "center",
    gap: 14,
    padding: 22,
  },
});
