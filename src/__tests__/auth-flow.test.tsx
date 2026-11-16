import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { router, useLocalSearchParams } from "expo-router";
import HomeScreen from "../app";
import LoginScreen from "../app/login";
import RegisterScreen from "../app/register";
import {
  ApiConfigurationError,
  ApiRequestError,
  eatUpApi,
  eatUpAuthApi,
} from "../services/eatup-api";
import React from "react";

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock("../services/eatup-api", () => {
  const actual = jest.requireActual<typeof import("../services/eatup-api")>(
    "../services/eatup-api",
  );
  return {
    ...actual,
    eatUpAuthApi: {
      login: jest.fn(),
      register: jest.fn(),
    },
    eatUpApi: {
      getWeekProgram: jest.fn(),
    },
  };
});

const mockedAuthApi = jest.mocked(eatUpAuthApi);
const mockedEatUpApi = jest.mocked(eatUpApi);
const mockedRouter = jest.mocked(router);
const mockedUseLocalSearchParams = jest.mocked(useLocalSearchParams);

describe("registration and login flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseLocalSearchParams.mockReturnValue({});
  });

  it("sends a registration request and routes to login without treating registration as sign-in", async () => {
    mockedAuthApi.register.mockResolvedValue(undefined);
    const { getByLabelText } = await render(<RegisterScreen />);

    await fireEvent.changeText(getByLabelText("Nome utente"), "nuovo-utente");
    await fireEvent.changeText(getByLabelText("Password"), "password");
    await fireEvent.press(getByLabelText("Invia registrazione"));

    await waitFor(() => {
      expect(mockedAuthApi.register).toHaveBeenCalledWith(
        "nuovo-utente",
        "password",
      );
    });
    expect(mockedAuthApi.login).not.toHaveBeenCalled();
    expect(mockedRouter.replace).toHaveBeenCalledWith(
      "/login?registrationComplete=true",
    );
  });

  it("prevents an incomplete registration", async () => {
    const { getByLabelText, getByText } = await render(<RegisterScreen />);

    await fireEvent.press(getByLabelText("Invia registrazione"));

    expect(getByText("Inserisci nome utente e password.")).toBeTruthy();
    expect(mockedAuthApi.register).not.toHaveBeenCalled();
  });

  it("returns to home after a successful login", async () => {
    mockedAuthApi.login.mockResolvedValue(undefined);
    const { getByLabelText } = await render(<LoginScreen />);

    await fireEvent.changeText(getByLabelText("Nome utente"), "utente");
    await fireEvent.changeText(getByLabelText("Password"), "password");
    await fireEvent.press(getByLabelText("Invia accesso"));

    await waitFor(() => {
      expect(mockedAuthApi.login).toHaveBeenCalledWith("utente", "password");
    });
    expect(mockedRouter.replace).toHaveBeenCalledWith("/?signedIn=true");
  });

  it("loads the protected Home preview after successful login", async () => {
    mockedAuthApi.login.mockResolvedValue(undefined);
    mockedEatUpApi.getWeekProgram.mockResolvedValue({ days: [] });
    const { getByLabelText } = await render(<LoginScreen />);

    await fireEvent.changeText(getByLabelText("Nome utente"), "utente");
    await fireEvent.changeText(getByLabelText("Password"), "password");
    await fireEvent.press(getByLabelText("Invia accesso"));

    await waitFor(() => {
      expect(mockedRouter.replace).toHaveBeenCalledWith("/?signedIn=true");
    });

    mockedUseLocalSearchParams.mockReturnValue({ signedIn: "true" });
    const { findByText } = await render(<HomeScreen />);

    expect(await findByText("Nessun pasto programmato per oggi.")).toBeTruthy();
    expect(mockedEatUpApi.getWeekProgram).toHaveBeenCalledTimes(1);
  });

  it("shows a confirmation when the registration flow returns to login", async () => {
    mockedUseLocalSearchParams.mockReturnValue({
      registrationComplete: "true",
    });
    const { getByText } = await render(<LoginScreen />);

    expect(getByText("Account creato. Accedi per continuare.")).toBeTruthy();
  });

  it("shows a clear credential error for rejected login", async () => {
    mockedAuthApi.login.mockRejectedValue(new ApiRequestError(401));
    const { getByLabelText, getByText } = await render(<LoginScreen />);

    await fireEvent.changeText(getByLabelText("Nome utente"), "utente");
    await fireEvent.changeText(getByLabelText("Password"), "wrong");
    await fireEvent.press(getByLabelText("Invia accesso"));

    await waitFor(() => {
      expect(getByText("Nome utente o password non corretti.")).toBeTruthy();
    });
    expect(mockedRouter.replace).not.toHaveBeenCalled();
  });

  it("explains when the secure server origin has not been configured", async () => {
    mockedAuthApi.login.mockRejectedValue(new ApiConfigurationError());
    const { getByLabelText, getByText } = await render(<LoginScreen />);

    await fireEvent.changeText(getByLabelText("Nome utente"), "utente");
    await fireEvent.changeText(getByLabelText("Password"), "password");
    await fireEvent.press(getByLabelText("Invia accesso"));

    await waitFor(() => {
      expect(
        getByText("La connessione sicura al server non è configurata."),
      ).toBeTruthy();
    });
  });
});
