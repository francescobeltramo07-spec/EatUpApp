import { fireEvent, render } from "@testing-library/react-native";
import { describe, expect, it, jest } from "@jest/globals";
import { IngredientPicker } from "../components/ingredient-picker";
import type { Ingredient } from "../services/eatup-api";
import React from "react";

describe("ingredient picker", () => {
  it("searches without accent sensitivity and reports selected ingredient names", async () => {
    const onSelectionChange = jest.fn<(ingredients: Ingredient[]) => void>();
    const categories = [
      {
        categoria: "Verdura",
        ingredienti: [{ id: "cetriolo", nome: "Cetriolo" }, { id: "peperone", nome: "Peperone" }],
      },
    ];
    const { getByLabelText, getByText, queryByText } = await render(
      <IngredientPicker
        categories={categories}
        selectedIngredients={[]}
        onSelectionChange={onSelectionChange}
      />,
    );

    await fireEvent.changeText(getByLabelText("Cerca ingrediente"), "peperoné");

    expect(getByText("Peperone")).toBeTruthy();
    expect(queryByText("Cetriolo")).toBeNull();

    await fireEvent.press(getByLabelText("Seleziona Peperone"));
    expect(onSelectionChange).toHaveBeenCalledWith([
      { id: "peperone", nome: "Peperone" },
    ]);
  });
});
