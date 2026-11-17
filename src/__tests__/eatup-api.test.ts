import { describe, expect, it, jest } from "@jest/globals";
import {
  ApiConfigurationError,
  createEatUpAuthApi,
  resolveApiOrigin,
} from "../services/eatup-api";

describe("EatUp authentication transport", () => {
  it("uses a configured HTTPS API origin on port 3000", () => {
    expect(resolveApiOrigin("https://eatup.example.test:3000")).toBe(
      "https://eatup.example.test:3000",
    );
  });

  it("uses a configured HTTPS API origin on the default port 443", () => {
    expect(resolveApiOrigin("https://eatup.example.test:443")).toBe(
      "https://eatup.example.test",
    );
    expect(resolveApiOrigin("https://eatup.example.test")).toBe(
      "https://eatup.example.test",
    );
  });

  it("fails closed before making a request when the API origin is missing", () => {
    const fetcher = jest.fn() as unknown as typeof fetch;

    expect(() => createEatUpAuthApi(undefined, fetcher)).toThrow(
      ApiConfigurationError,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uses the HTTPS server origin and lets the native cookie jar handle sessions", async () => {
    const fetcher = (jest
      .fn() as jest.MockedFunction<typeof fetch>)
      .mockResolvedValue({ ok: true, status: 200 } as Response) as unknown as
      typeof fetch;
    const api = createEatUpAuthApi("https://eatup.example.test:3000", fetcher);

    await api.login("utente", "password");

    expect(fetcher).toHaveBeenCalledWith(
      "https://eatup.example.test:3000/api/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ username: "utente", password: "password" }),
      }),
    );
    const [, options] = (fetcher as jest.Mock).mock.calls[0];
    expect((options as RequestInit).headers).not.toHaveProperty("Authorization");
  });

  it("does not read the HTTP-only session cookie from the login response", async () => {
    const response = {
      ok: true,
      get headers() {
        throw new Error("The app must not inspect Set-Cookie in JavaScript.");
      },
    } as unknown as Response;
    const fetcher = (jest.fn() as jest.MockedFunction<typeof fetch>).mockResolvedValue(
      response,
    ) as unknown as typeof fetch;
    const api = createEatUpAuthApi("https://eatup.example.test:3000", fetcher);

    await expect(api.login("utente", "password")).resolves.toBeUndefined();

    expect(fetcher).toHaveBeenCalledWith(
      "https://eatup.example.test:3000/api/login",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("sends registration with only the fields accepted by the server", async () => {
    const fetcher = (jest
      .fn() as jest.MockedFunction<typeof fetch>)
      .mockResolvedValue({ ok: true, status: 200 } as Response) as unknown as
      typeof fetch;
    const api = createEatUpAuthApi("https://eatup.example.test:3000", fetcher);

    await api.register("utente", "password");

    expect(fetcher).toHaveBeenCalledWith(
      "https://eatup.example.test:3000/api/register",
      expect.objectContaining({
        credentials: "include",
        body: JSON.stringify({ username: "utente", password: "password" }),
      }),
    );
  });

  it("loads the saved weekly program through the native cookie jar", async () => {
    const program = { days: [] };
    const fetcher = (jest
      .fn() as jest.MockedFunction<typeof fetch>)
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn<() => Promise<typeof program>>().mockResolvedValue(program),
      } as unknown as Response) as unknown as typeof fetch;
    const api = createEatUpAuthApi("https://eatup.example.test:3000", fetcher);

    await expect(api.getWeekProgram()).resolves.toEqual(program);

    expect(fetcher).toHaveBeenCalledWith(
      "https://eatup.example.test:3000/api/weekProgram",
      {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
      },
    );
  });

  it("surfaces the protected program request status without reading an error body", async () => {
    const response = {
      ok: false,
      status: 403,
      get headers() {
        throw new Error("The app must not inspect cookie headers.");
      },
    } as unknown as Response;
    const fetcher = (jest.fn() as jest.MockedFunction<typeof fetch>).mockResolvedValue(
      response,
    ) as unknown as typeof fetch;
    const api = createEatUpAuthApi("https://eatup.example.test:3000", fetcher);

    await expect(api.getWeekProgram()).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 403,
    });
  });

  it.each([
    "http://eatup.example.test:3000",
    "https://eatup.example.test:3001",
    "https://user:password@eatup.example.test:3000",
    "https://eatup.example.test:3000/api",
    "https://eatup.example.test:3000?query=1",
    "https://eatup.example.test:3000#fragment",
  ])("rejects an unsafe or malformed API origin: %s", (origin) => {
    expect(() => resolveApiOrigin(origin)).toThrow(ApiConfigurationError);
  });

  it("surfaces the HTTP status without exposing the response body", async () => {
    const fetcher = (jest
      .fn() as jest.MockedFunction<typeof fetch>)
      .mockResolvedValue({ ok: false, status: 401 } as Response) as unknown as
      typeof fetch;
    const api = createEatUpAuthApi("https://eatup.example.test:3000", fetcher);

    await expect(api.login("utente", "wrong")).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 401,
    });
  });

  it("uses the existing REST contracts for meal, recipe, ingredient, and shopping data", async () => {
    const fetcher = (jest
      .fn() as jest.MockedFunction<typeof fetch>)
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn<() => Promise<unknown>>().mockResolvedValue({}),
      } as unknown as Response) as unknown as typeof fetch;
    const api = createEatUpAuthApi("https://eatup.example.test", fetcher);
    const preferences = {
      calorie: 2100,
      proteine: 100,
      preferenze: "vegetariano",
      intolleranze: "lattosio",
    };

    await api.getIngredients();
    await api.generateWeekProgram(preferences);
    await api.getGeneratedRecipes();
    await api.generateRecipesFromIngredients(["pomodoro"]);
    await api.getShoppingList();
    await api.generateShoppingList(["uova"]);

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "https://eatup.example.test/api/getIngredients",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "https://eatup.example.test/api/generateWeekProgram",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        body: JSON.stringify(preferences),
      }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      "https://eatup.example.test/api/generatedRecipes",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      4,
      "https://eatup.example.test/api/generateRecipesFromIngredients",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ ingredients: ["pomodoro"] }),
      }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      5,
      "https://eatup.example.test/api/shoppingList",
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      6,
      "https://eatup.example.test/api/generateShoppingList",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ availableIngredients: ["uova"] }),
      }),
    );
  });
});
