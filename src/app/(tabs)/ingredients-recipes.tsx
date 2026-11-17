import React, { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, type Href } from "expo-router";
import { IngredientPicker, getIngredientName } from "../../components/ingredient-picker";
import { useAuth } from "../../contexts/auth-context";
import type {
  GeneratedRecipe,
  Ingredient,
  IngredientCategory,
  RecipeGroups,
} from "../../services/eatup-api";
import { eatUpApi, resolveApiImageUrl } from "../../services/eatup-api";

type RecipeGroup = {
  key: "soloSelezionati" | "pochiExtra" | "daComprare";
  title: string;
  subtitle: string;
  recipes: GeneratedRecipe[];
};

const groupDefinitions: Omit<RecipeGroup, "recipes">[] = [
  {
    key: "soloSelezionati",
    title: "Solo ingredienti selezionati",
    subtitle: "Ricette fattibili con quello che hai già scelto.",
  },
  {
    key: "pochiExtra",
    title: "Con 2 o 3 ingredienti in più",
    subtitle: "Piccole aggiunte per ricette più complete.",
  },
  {
    key: "daComprare",
    title: "Da comprare, ma ne vale la pena",
    subtitle: "Idee più ambiziose con ingredienti extra mirati.",
  },
];

function normalizeGroups(data: RecipeGroups): RecipeGroup[] {
  return groupDefinitions.map((group) => ({
    ...group,
    recipes: Array.isArray(data[group.key]) ? data[group.key] ?? [] : [],
  }));
}

function recipeTitle(recipe: GeneratedRecipe): string {
  return recipe.titolo ?? recipe.title ?? "Ricetta consigliata";
}

function recipeQuality(recipe: GeneratedRecipe): number {
  const quality = Number(recipe.qualita ?? recipe.quality ?? 0);
  return Number.isFinite(quality) ? Math.min(5, Math.max(0, quality)) : 0;
}

function recipeIngredients(recipe: GeneratedRecipe): string[] {
  const ingredients = recipe.ingredienti ?? recipe.ingredients;
  return Array.isArray(ingredients) ? ingredients.map(String) : [];
}

function recipeExtraIngredients(recipe: GeneratedRecipe): string[] {
  const ingredients = recipe.ingredientiExtra ?? recipe.extraIngredients;
  return Array.isArray(ingredients) ? ingredients.map(String) : [];
}

export default function IngredientsRecipesScreen() {
  const { signedIn } = useAuth();
  const [categories, setCategories] = useState<IngredientCategory[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<Ingredient[]>(
    [],
  );
  const [recipeGroups, setRecipeGroups] = useState<RecipeGroup[]>(
    normalizeGroups({}),
  );
  const [loadingIngredients, setLoadingIngredients] = useState(true);
  const [ingredientPickerExpanded, setIngredientPickerExpanded] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [imageFailures, setImageFailures] = useState<Record<string, boolean>>(
    {},
  );

  useEffect(() => {
    let active = true;
    eatUpApi
      .getIngredients()
      .then((response) => {
        if (!active) {
          return;
        }
        const catalog = Array.isArray(response)
          ? response
          : (response.categories ?? []);
        setCategories(catalog);
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
  }, []);

  useEffect(() => {
    if (!signedIn) {
      return;
    }

    let active = true;
    eatUpApi
      .getGeneratedRecipes()
      .then((data) => {
        if (active) {
          const savedGroups = normalizeGroups(data);
          setRecipeGroups(savedGroups);
          if (savedGroups.some((group) => group.recipes.length > 0)) {
            setIngredientPickerExpanded(false);
          }
        }
      })
      .catch(() => {
        if (active) {
          setError("Non sono riuscito a caricare le ricette salvate.");
        }
      });

    return () => {
      active = false;
    };
  }, [signedIn]);

  async function generateRecipes() {
    setError("");

    if (selectedIngredients.length === 0) {
      setError("Seleziona almeno un ingrediente prima di cercare ricette.");
      return;
    }

    if (!signedIn) {
      setError("Devi effettuare il login per generare ricette con l'AI.");
      return;
    }

    setGenerating(true);
    try {
      const ingredients = selectedIngredients.map(getIngredientName);
      const data = await eatUpApi.generateRecipesFromIngredients(ingredients);
      setRecipeGroups(normalizeGroups(data));
      setImageFailures({});
      setIngredientPickerExpanded(false);
    } catch {
      setError("Non sono riuscito a generare le ricette. Riprova tra poco.");
    } finally {
      setGenerating(false);
    }
  }

  const hasRecipes = recipeGroups.some((group) => group.recipes.length > 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        

        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>Ricette intelligenti</Text>
            <Text accessibilityRole="header" style={styles.title}>
              Trova ricette con quello che hai in casa
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Trova ricette"
            accessibilityRole="button"
            accessibilityState={{
              disabled: selectedIngredients.length === 0 || generating,
              busy: generating,
            }}
            disabled={selectedIngredients.length === 0 || generating}
            onPress={generateRecipes}
            style={[
              styles.primaryButton,
              (selectedIngredients.length === 0 || generating) &&
                styles.buttonDisabled,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {generating ? "Ricerca in corso..." : "Trova ricette"}
            </Text>
          </Pressable>
        </View>

        {!signedIn ? (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>
              Per generare ricette devi prima accedere.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push("/login" as Href)}
            >
              <Text style={styles.loginLink}>Vai al login</Text>
            </Pressable>
          </View>
        ) : null}

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

        {!hasRecipes ? (
          <View style={styles.emptyCard}>
            <Text style={styles.sectionTitle}>Le ricette appariranno qui</Text>
            <Text style={styles.bodyText}>
              Il risultato sarà diviso tra ricette immediate, ricette con pochi
              ingredienti extra e idee da fare dopo una piccola spesa.
            </Text>
          </View>
        ) : (
          <View style={styles.groups}>
            {recipeGroups.map((group) => (
              <View key={group.key} style={styles.group}>
                <View style={styles.groupHeading}>
                  <Text style={styles.sectionTitle}>{group.title}</Text>
                  <Text style={styles.bodyText}>{group.subtitle}</Text>
                </View>
                {group.recipes.map((recipe, index) => {
                  const title = recipeTitle(recipe);
                  const imageKey = `${group.key}-${index}-${title}`;
                  const imageUri = resolveApiImageUrl(
                    recipe.immagine ?? recipe.image,
                  );
                  const ingredients = recipeIngredients(recipe);
                  const extraIngredients = recipeExtraIngredients(recipe);
                  const quality = recipeQuality(recipe);

                  return (
                    <View key={imageKey} style={styles.recipeCard}>
                      {imageUri && !imageFailures[imageKey] ? (
                        <Image
                          accessibilityLabel={`Immagine: ${title}`}
                          onError={() =>
                            setImageFailures((current) => ({
                              ...current,
                              [imageKey]: true,
                            }))
                          }
                          source={{ uri: imageUri }}
                          style={styles.recipeImage}
                        />
                      ) : (
                        <View style={styles.imageFallback}>
                          <Text style={styles.imageFallbackText}>
                            Immagine non disponibile
                          </Text>
                        </View>
                      )}

                      <View style={styles.recipeBody}>
                        <Text style={styles.rating}>
                          {"★".repeat(quality)}
                          {"☆".repeat(5 - quality)} {quality}/5
                        </Text>
                        <Text accessibilityRole="header" style={styles.recipeTitle}>
                          {title}
                        </Text>
                        <Text style={styles.bodyText}>
                          {recipe.descrizione ??
                            recipe.description ??
                            ""}
                        </Text>
                        <View style={styles.tags}>
                          {ingredients.map((ingredient, ingredientIndex) => (
                            <Text
                              key={`${ingredient}-${ingredientIndex}`}
                              style={styles.tag}
                            >
                              {ingredient}
                            </Text>
                          ))}
                        </View>
                        {extraIngredients.length > 0 ? (
                          <View style={styles.extraBox}>
                            <Text style={styles.extraTitle}>Da aggiungere</Text>
                            <Text style={styles.bodyText}>
                              {extraIngredients.join(", ")}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
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
  header: {
    gap: 14,
  },
  headerText: {
    gap: 7,
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
    fontSize: 27,
    fontWeight: "900",
    lineHeight: 34,
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
    opacity: 0.55,
  },
  notice: {
    gap: 6,
    padding: 14,
    borderRadius: 9,
    backgroundColor: "#FFEDD5",
  },
  noticeText: {
    color: "#7C2D12",
  },
  loginLink: {
    color: "#9A3412",
    fontWeight: "800",
    textDecorationLine: "underline",
  },
  error: {
    padding: 12,
    borderRadius: 8,
    color: "#991B1B",
    backgroundColor: "#FEE2E2",
  },
  emptyCard: {
    gap: 8,
    padding: 18,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  groups: {
    gap: 20,
  },
  group: {
    gap: 12,
  },
  groupHeading: {
    gap: 4,
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
  recipeCard: {
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  recipeImage: {
    width: "100%",
    height: 190,
    backgroundColor: "#FED7AA",
  },
  imageFallback: {
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFEDD5",
  },
  imageFallbackText: {
    color: "#9A3412",
    fontWeight: "700",
  },
  recipeBody: {
    gap: 9,
    padding: 15,
  },
  rating: {
    color: "#C2410C",
    fontWeight: "800",
  },
  recipeTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    color: "#9A3412",
    backgroundColor: "#FFEDD5",
  },
  extraBox: {
    gap: 4,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
  },
  extraTitle: {
    color: "#334155",
    fontWeight: "800",
  },
});
