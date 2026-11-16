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
    "https://eatup.example.test",
    "https://user:password@eatup.example.test:3000",
    "https://eatup.example.test:3000/api",
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
});
