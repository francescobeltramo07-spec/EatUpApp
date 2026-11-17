import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { router } from "expo-router";
import IngredientsRecipesScreen from "../app/(tabs)/ingredients-recipes";
import { useAuth } from "../contexts/auth-context";
import { eatUpApi } from "../services/eatup-api";
import React from "react";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

jest.mock("../contexts/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("../services/eatup-api", () => ({
  eatUpApi: {
    getIngredients: jest.fn(),
    getGeneratedRecipes: jest.fn(),
    generateRecipesFromIngredients: jest.fn(),
  },
  resolveApiImageUrl: jest.fn((image: string) => image),
}));

const mockedApi = jest.mocked(eatUpApi);
const mockedAuth = jest.mocked(useAuth);

describe("ingredient recipes screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuth.mockReturnValue({ signedIn: true, setSignedIn: jest.fn() });
    mockedApi.getIngredients.mockResolvedValue([
      { categoria: "Verdura", ingredienti: [{ id: "pomodoro", nome: "Pomodoro" }] },
    ]);
    mockedApi.getGeneratedRecipes.mockResolvedValue({
      soloSelezionati: [],
      pochiExtra: [],
      daComprare: [],
    });
  });

  it("sends selected ingredients and renders the generated recipe group", async () => {
    mockedApi.generateRecipesFromIngredients.mockResolvedValue({
      soloSelezionati: [
        {
          titolo: "Pasta al pomodoro",
          qualita: 4,
          immagine: "",
          ingredienti: ["Pomodoro"],
          ingredientiExtra: [],
          descrizione: "Un piatto semplice.",
        },
      ],
      pochiExtra: [],
      daComprare: [],
    });

    const { findByText, getByLabelText, getByText } = await render(
      <IngredientsRecipesScreen />,
    );

    await fireEvent.press(getByLabelText("Seleziona Pomodoro"));
    await fireEvent.press(getByLabelText("Trova ricette"));

    await waitFor(() => {
      expect(mockedApi.generateRecipesFromIngredients).toHaveBeenCalledWith([
        "Pomodoro",
      ]);
    });
    expect(await findByText("Pasta al pomodoro")).toBeTruthy();
    expect(getByText("Solo ingredienti selezionati")).toBeTruthy();
  });

  it("does not load saved recipes or generate while signed out", async () => {
    mockedAuth.mockReturnValue({ signedIn: false, setSignedIn: jest.fn() });
    const { findByText } = await render(<IngredientsRecipesScreen />);

    expect(await findByText("Per generare ricette devi prima accedere.")).toBeTruthy();
    expect(mockedApi.getGeneratedRecipes).not.toHaveBeenCalled();
    expect(mockedApi.generateRecipesFromIngredients).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });
});
