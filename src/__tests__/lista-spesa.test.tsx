import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import ShoppingListScreen from "../app/(tabs)/lista-spesa";
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
    getShoppingList: jest.fn(),
    generateShoppingList: jest.fn(),
  },
}));

const mockedApi = jest.mocked(eatUpApi);
const mockedAuth = jest.mocked(useAuth);

describe("shopping list screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuth.mockReturnValue({ signedIn: true, setSignedIn: jest.fn() });
    mockedApi.getIngredients.mockResolvedValue([]);
    mockedApi.getShoppingList.mockResolvedValue({
      categories: [
        {
          categoria: "Frutta e verdura",
          items: [{ nome: "Pomodori", quantita: "3", motivo: "Ricette" }],
        },
      ],
      sources: { weekProgram: true, recipes: true },
    });
  });

  it("shows saved items and updates check counts", async () => {
    const { findByText, getByLabelText, getByText } = await render(
      <ShoppingListScreen />,
    );

    expect(await findByText("Pomodori")).toBeTruthy();
    expect(getByText("0 spuntati")).toBeTruthy();
    await fireEvent.press(getByLabelText("Spunta Pomodori"));
    expect(getByText("1 spuntati")).toBeTruthy();
    await fireEvent.press(getByLabelText("Ripristina"));
    expect(getByText("0 spuntati")).toBeTruthy();
  });

  it("submits selected pantry ingredients to generate the list", async () => {
    mockedApi.getIngredients.mockResolvedValue([
      { categoria: "Verdura", ingredienti: [{ nome: "Pomodoro" }] },
    ]);
    mockedApi.generateShoppingList.mockResolvedValue({
      categories: [],
      sources: { weekProgram: true, recipes: false },
    });
    const { findByText, getByLabelText } = await render(<ShoppingListScreen />);

    await findByText("Pomodoro");
    await fireEvent.press(getByLabelText("Seleziona Pomodoro"));
    await fireEvent.press(getByLabelText("Genera lista"));

    await waitFor(() => {
      expect(mockedApi.generateShoppingList).toHaveBeenCalledWith(["Pomodoro"]);
    });
  });
});
