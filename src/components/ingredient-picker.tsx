import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type {
  Ingredient,
  IngredientCategory,
} from "../services/eatup-api";

type IngredientPickerProps = {
  categories: IngredientCategory[];
  selectedIngredients: Ingredient[];
  onSelectionChange: (ingredients: Ingredient[]) => void;
  loading?: boolean;
};

export function getIngredientName(ingredient: Ingredient): string {
  if (typeof ingredient === "string") {
    return ingredient;
  }

  return ingredient.nome ?? ingredient.name ?? String(ingredient);
}

export function normalizeIngredientSearch(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function sameIngredient(first: Ingredient, second: Ingredient): boolean {
  const firstKey =
    typeof first === "string"
      ? first
      : (first.id ?? first._id ?? getIngredientName(first));
  const secondKey =
    typeof second === "string"
      ? second
      : (second.id ?? second._id ?? getIngredientName(second));
  return firstKey === secondKey;
}

export function IngredientPicker({
  categories,
  selectedIngredients,
  onSelectionChange,
  loading = false,
}: IngredientPickerProps) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const query = normalizeIngredientSearch(search);
  const visibleCategories = categories
    .map((category, index) => {
      const ingredients = category.ingredienti ?? [];
      const matches = query
        ? ingredients.filter((ingredient) =>
            normalizeIngredientSearch(getIngredientName(ingredient)).includes(
              query,
            ),
          )
        : ingredients;

      return { category, index, ingredients: matches };
    })
    .filter(({ ingredients }) => ingredients.length > 0);

  function toggleIngredient(ingredient: Ingredient) {
    const selected = selectedIngredients.some((current) =>
      sameIngredient(current, ingredient),
    );
    onSelectionChange(
      selected
        ? selectedIngredients.filter(
            (current) => !sameIngredient(current, ingredient),
          )
        : [...selectedIngredients, ingredient],
    );
  }

  function categoryTitle(category: IngredientCategory): string {
    return category.categoria ?? category.category ?? "Altro";
  }

  return (
    <View style={styles.panel}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>Ingredienti</Text>
        <Text style={styles.count}>{selectedIngredients.length}</Text>
      </View>

      <TextInput
        accessibilityLabel="Cerca ingrediente"
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setSearch}
        placeholder="Es. pasta, pomodoro, uova"
        style={styles.search}
        value={search}
      />

      {selectedIngredients.length > 0 ? (
        <View style={styles.selectedList}>
          {selectedIngredients.map((ingredient, index) => {
            const name = getIngredientName(ingredient);
            return (
              <Pressable
                accessibilityLabel={`Rimuovi ${name}`}
                accessibilityRole="button"
                key={`${name}-${index}`}
                onPress={() => toggleIngredient(ingredient)}
                style={styles.chip}
              >
                <Text style={styles.chipText}>{name} ×</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Text style={styles.muted}>Seleziona gli ingredienti che hai in casa.</Text>
      )}

      {loading ? (
        <ActivityIndicator
          accessibilityLabel="Caricamento ingredienti"
          color="#F97316"
        />
      ) : visibleCategories.length === 0 ? (
        <Text style={styles.muted}>Nessun ingrediente trovato.</Text>
      ) : (
        <View style={styles.categories}>
          {visibleCategories.map(({ category, index, ingredients }) => {
            const key = `${categoryTitle(category)}-${index}`;
            const isOpen = expanded[key] ?? index === 0;
            return (
              <View key={key} style={styles.category}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  onPress={() =>
                    setExpanded((current) => ({
                      ...current,
                      [key]: !isOpen,
                    }))
                  }
                  style={styles.categoryButton}
                >
                  <Text style={styles.categoryText}>{categoryTitle(category)}</Text>
                  <Text style={styles.chevron}>{isOpen ? "⌄" : "›"}</Text>
                </Pressable>
                {isOpen ? (
                  <View style={styles.ingredientList}>
                    {ingredients.map((ingredient, ingredientIndex) => {
                      const name = getIngredientName(ingredient);
                      const isSelected = selectedIngredients.some((current) =>
                        sameIngredient(current, ingredient),
                      );
                      return (
                        <Pressable
                          accessibilityLabel={`${isSelected ? "Deseleziona" : "Seleziona"} ${name}`}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: isSelected }}
                          key={`${name}-${ingredientIndex}`}
                          onPress={() => toggleIngredient(ingredient)}
                          style={[
                            styles.ingredient,
                            isSelected && styles.ingredientSelected,
                          ]}
                        >
                          <Text style={styles.checkbox}>{isSelected ? "✓" : "○"}</Text>
                          <Text style={styles.ingredientText}>{name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: {
    color: "#F97316",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  count: {
    color: "#111827",
    fontWeight: "800",
  },
  search: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 9,
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  muted: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 21,
  },
  selectedList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: "#FFEDD5",
  },
  chipText: {
    color: "#9A3412",
    fontSize: 13,
    fontWeight: "700",
  },
  categories: {
    gap: 8,
  },
  category: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 9,
  },
  categoryButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    backgroundColor: "#FFF7ED",
  },
  categoryText: {
    color: "#111827",
    fontWeight: "800",
  },
  chevron: {
    color: "#F97316",
    fontSize: 20,
  },
  ingredientList: {
    padding: 8,
    gap: 4,
  },
  ingredient: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 8,
    borderRadius: 7,
  },
  ingredientSelected: {
    backgroundColor: "#FFF7ED",
  },
  checkbox: {
    width: 20,
    color: "#F97316",
    fontSize: 18,
    fontWeight: "800",
  },
  ingredientText: {
    flex: 1,
    color: "#334155",
  },
});
