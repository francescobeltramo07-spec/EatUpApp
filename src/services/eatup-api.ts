import Constants from "expo-constants";

export class ApiConfigurationError extends Error {
  constructor() {
    super("EatUp API origin must use HTTPS on port 3000 or 443.");
    this.name = "ApiConfigurationError";
  }
}

export class ApiRequestError extends Error {
  constructor(readonly status: number) {
    super(`EatUp API request failed with status ${status}.`);
    this.name = "ApiRequestError";
  }
}

export function resolveApiOrigin(configuredOrigin: unknown): string {
  if (typeof configuredOrigin !== "string" || configuredOrigin.trim() === "") {
    throw new ApiConfigurationError();
  }

  let url: URL;
  try {
    url = new URL(configuredOrigin);
  } catch {
    throw new ApiConfigurationError();
  }

  if (
    url.protocol !== "https:" ||
    (url.port !== "" && url.port !== "3000") ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new ApiConfigurationError();
  }

  return url.origin;
}

type Credentials = {
  username: string;
  password: string;
};

export type WeekProgramDay = {
  date?: string;
  colazione?: string | null;
  pranzo?: string | null;
  merenda?: string | null;
  cena?: string | null;
};

export type WeekProgramResponse = {
  days: WeekProgramDay[];
  [key: string]: unknown;
};

export function createEatUpAuthApi(
  configuredOrigin: unknown,
  fetcher: typeof fetch = fetch,
) {
  const apiUrl = `${resolveApiOrigin(configuredOrigin)}/api`;

  async function post(path: "login" | "register", credentials: Credentials) {
    const response = await fetcher(`${apiUrl}/${path}`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      throw new ApiRequestError(response.status);
    }
  }

  async function getWeekProgram(): Promise<WeekProgramResponse> {
    const response = await fetcher(`${apiUrl}/weekProgram`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new ApiRequestError(response.status);
    }

    return (await response.json()) as WeekProgramResponse;
  }

  return {
    login: (username: string, password: string) =>
      post("login", { username, password }),
    register: (username: string, password: string) =>
      post("register", { username, password }),
    getWeekProgram,
  };
}

function configuredOrigin(): unknown {
  return Constants.expoConfig?.extra?.eatUpApiOrigin;
}

export const eatUpAuthApi = {
  login: (username: string, password: string) =>
    createEatUpAuthApi(configuredOrigin()).login(username, password),
  register: (username: string, password: string) =>
    createEatUpAuthApi(configuredOrigin()).register(username, password),
};

export const eatUpApi = {
  getWeekProgram: () =>
    createEatUpAuthApi(configuredOrigin()).getWeekProgram(),
};
