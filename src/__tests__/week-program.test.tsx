import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import WeekProgramScreen from "../app/(tabs)/week-program";
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
    getWeekProgram: jest.fn(),
    generateWeekProgram: jest.fn(),
  },
}));

const mockedApi = jest.mocked(eatUpApi);
const mockedAuth = jest.mocked(useAuth);

describe("weekly program screen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAuth.mockReturnValue({ signedIn: true, setSignedIn: jest.fn() });
    mockedApi.getWeekProgram.mockResolvedValue({ days: [] });
  });

  it("validates calories and submits the existing preference field names", async () => {
    const { getByLabelText, getByText } = await render(<WeekProgramScreen />);

    await fireEvent.press(getByLabelText("Genera programma"));
    expect(getByText("Inserisci un numero di calorie maggiore di zero.")).toBeTruthy();
    expect(mockedApi.generateWeekProgram).not.toHaveBeenCalled();

    await fireEvent.changeText(getByLabelText("Calorie giornaliere"), "2100");
    await fireEvent.changeText(getByLabelText("Proteine (g)"), "100");
    await fireEvent.changeText(getByLabelText("Preferenze alimentari"), "vegetariano");
    await fireEvent.press(getByLabelText("Genera programma"));

    await waitFor(() => {
      expect(mockedApi.generateWeekProgram).toHaveBeenCalledWith(
        expect.objectContaining({
          calorie: 2100,
          proteine: 100,
          preferenze: "vegetariano",
        }),
      );
    });
  });

  it("shows a login prompt and does not request protected data while signed out", async () => {
    mockedAuth.mockReturnValue({ signedIn: false, setSignedIn: jest.fn() });
    const { findByText } = await render(<WeekProgramScreen />);

    expect(await findByText("Devi effettuare il login per usare il programma settimanale.")).toBeTruthy();
    expect(mockedApi.getWeekProgram).not.toHaveBeenCalled();
  });
});
