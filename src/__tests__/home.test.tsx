import { fireEvent, render } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import HomeScreen from "../app";
import { useLocalSearchParams } from "expo-router";
import { eatUpApi } from "../services/eatup-api";
import React from "react";

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
  },
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock("../services/eatup-api", () => ({
  eatUpApi: {
    getWeekProgram: jest.fn(),
  },
}));

const mockedParams = jest.mocked(useLocalSearchParams);
const mockedEatUpApi = jest.mocked(eatUpApi);

describe("home screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedParams.mockReturnValue({});
  });

  it("renders the welcome content and updates the ingredient count", async () => {
    const { getByText } = await render(<HomeScreen />);

    expect(getByText("Ciao EatUp!")).toBeTruthy();
    await fireEvent.press(getByText("Aggiungi ingrediente"));
    expect(getByText("Ingredienti scelti: 1")).toBeTruthy();
    expect(mockedEatUpApi.getWeekProgram).not.toHaveBeenCalled();
  });

  it("loads and displays today's saved meals after login", async () => {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    mockedParams.mockReturnValue({ signedIn: "true" });
    mockedEatUpApi.getWeekProgram.mockResolvedValue({
      days: [
        {
          date,
          colazione: "Yogurt e frutta",
          pranzo: "Pasta",
          merenda: "",
          cena: null,
        },
      ],
    });

    const { findByText, getByText } = await render(<HomeScreen />);

    expect(await findByText("Colazione: Yogurt e frutta")).toBeTruthy();
    expect(getByText("Pranzo: Pasta")).toBeTruthy();
    expect(getByText("Merenda: Non indicato")).toBeTruthy();
    expect(getByText("Cena: Non indicato")).toBeTruthy();
    expect(mockedEatUpApi.getWeekProgram).toHaveBeenCalledTimes(1);
  });

  it("shows a clear empty state when there is no plan for today", async () => {
    mockedParams.mockReturnValue({ signedIn: "true" });
    mockedEatUpApi.getWeekProgram.mockResolvedValue({ days: [] });

    const { findByText } = await render(<HomeScreen />);

    expect(await findByText("Nessun pasto programmato per oggi.")).toBeTruthy();
  });

  it("allows retry after a failed protected request", async () => {
    mockedParams.mockReturnValue({ signedIn: "true" });
    mockedEatUpApi.getWeekProgram
      .mockRejectedValueOnce(new Error("request failed"))
      .mockResolvedValueOnce({ days: [] });

    const { findByText, getByLabelText } = await render(<HomeScreen />);

    expect(
      await findByText(
        "Programma non disponibile. Controlla la connessione e riprova.",
      ),
    ).toBeTruthy();
    await fireEvent.press(getByLabelText("Riprova programma"));
    expect(await findByText("Nessun pasto programmato per oggi.")).toBeTruthy();
    expect(mockedEatUpApi.getWeekProgram).toHaveBeenCalledTimes(2);
  });
});
