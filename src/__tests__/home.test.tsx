import { fireEvent, render } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import HomeScreen from "../app/(tabs)/index";
import { router } from "expo-router";
import { useAuth } from "../contexts/auth-context";
import { eatUpApi } from "../services/eatup-api";
import React from "react";

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock("../contexts/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("../services/eatup-api", () => ({
  eatUpApi: {
    getWeekProgram: jest.fn(),
  },
}));

const mockedAuth = jest.mocked(useAuth);
const mockedEatUpApi = jest.mocked(eatUpApi);

describe("home screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuth.mockReturnValue({ signedIn: false, setSignedIn: jest.fn() });
  });

  it("renders the EatUp home content and feature cards", async () => {
    const { getByRole, getByText } = await render(<HomeScreen />);

    expect(getByText("Cucina intelligente")).toBeTruthy();
    expect(getByText("EatUp")).toBeTruthy();
    expect(
      getByText(
        "Organizza ingredienti, ricette e programma settimanale in un unico posto.",
      ),
    ).toBeTruthy();
    expect(getByText("Ingredienti smart")).toBeTruthy();
    expect(getByText("Ricette con AI")).toBeTruthy();
    expect(getByText("Programma settimanale")).toBeTruthy();
    await fireEvent.press(getByText("Trova ricette"));
    await fireEvent.press(getByText("Programma settimana"));
    expect(router.push).toHaveBeenNthCalledWith(1, "/login");
    expect(router.push).toHaveBeenNthCalledWith(2, "/register");
    expect(getByRole("button", { name: "Accedi" })).toBeTruthy();
    expect(mockedEatUpApi.getWeekProgram).not.toHaveBeenCalled();
  });

  it("opens all feature routes directly for signed-in users", async () => {
    mockedAuth.mockReturnValue({ signedIn: true, setSignedIn: jest.fn() });
    mockedEatUpApi.getWeekProgram.mockResolvedValue({ days: [] });
    const { getAllByText, getByText } = await render(<HomeScreen />);

    await fireEvent.press(getByText("Trova ricette"));
    await fireEvent.press(getByText("Programma settimana"));
    await fireEvent.press(getAllByText("Lista della spesa")[0]);

    expect(router.push).toHaveBeenNthCalledWith(
      1,
      "/ingredients-recipes",
    );
    expect(router.push).toHaveBeenNthCalledWith(
      2,
      "/week-program",
    );
    expect(router.push).toHaveBeenNthCalledWith(
      3,
      "/lista-spesa",
    );
  });

  it("loads and displays today's saved meals after login", async () => {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    mockedAuth.mockReturnValue({ signedIn: true, setSignedIn: jest.fn() });
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

    const { findByText, getAllByText, getByText } = await render(<HomeScreen />);

    expect(await findByText("Yogurt e frutta")).toBeTruthy();
    expect(getByText("Colazione")).toBeTruthy();
    expect(getByText("Pasta")).toBeTruthy();
    expect(getByText("Merenda")).toBeTruthy();
    expect(getByText("Cena")).toBeTruthy();
    expect(getAllByText("Non indicato")).toHaveLength(2);
    expect(mockedEatUpApi.getWeekProgram).toHaveBeenCalledTimes(1);
  });

  it("shows a clear empty state when there is no plan for today", async () => {
    mockedAuth.mockReturnValue({ signedIn: true, setSignedIn: jest.fn() });
    mockedEatUpApi.getWeekProgram.mockResolvedValue({ days: [] });

    const { findByText } = await render(<HomeScreen />);

    expect(await findByText("Nessun pasto programmato per oggi.")).toBeTruthy();
  });

  it("allows retry after a failed protected request", async () => {
    mockedAuth.mockReturnValue({ signedIn: true, setSignedIn: jest.fn() });
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
