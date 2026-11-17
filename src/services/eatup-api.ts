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
  giorno?: string;
  date?: string;
  colazione?: unknown;
  pranzo?: unknown;
  merenda?: unknown;
  cena?: unknown;
};

export type WeekProgramResponse = {
  startDate?: string;
  endDate?: string;
  preferences?: WeekProgramPreferences;
  days: WeekProgramDay[];
  [key: string]: unknown;
};

export type WeekProgramPreferences = {
  calorie?: number | null;
  proteine?: number | null;
  carboidrati?: number | null;
  grassi?: number | null;
  fibre?: number | null;
  preferenze?: string;
  intolleranze?: string;
};

export type Ingredient =
  | string
  | {
      id?: string;
      _id?: string;
      nome?: string;
      name?: string;
      [key: string]: unknown;
    };

export type IngredientCategory = {
  categoria?: string;
  category?: string;
  ingredienti?: Ingredient[];
  open?: boolean;
};

export type IngredientCatalogResponse =
  | IngredientCategory[]
  | { categories?: IngredientCategory[] };

export type GeneratedRecipe = {
  titolo?: string;
  title?: string;
  qualita?: number;
  quality?: number;
  immagine?: string;
  image?: string;
  ingredienti?: string[];
  ingredients?: string[];
  ingredientiExtra?: string[];
  extraIngredients?: string[];
  descrizione?: string;
  description?: string;
};

export type RecipeGroups = {
  soloSelezionati?: GeneratedRecipe[];
  pochiExtra?: GeneratedRecipe[];
  daComprare?: GeneratedRecipe[];
};

export type ShoppingListItem = {
  nome?: string;
  name?: string;
  quantita?: string;
  quantity?: string;
  motivo?: string;
  reason?: string;
};

export type ShoppingListCategory = {
  categoria?: string;
  category?: string;
  items?: ShoppingListItem[];
};

export type ShoppingListResponse = {
  categories?: ShoppingListCategory[];
  sources?: {
    weekProgram?: boolean;
    recipes?: boolean;
  };
  cached?: boolean;
};

export type ShoppingListSourceSelection = {
  weekProgram: boolean;
  recipes: boolean;
};

export function createEatUpAuthApi(
  configuredOrigin: unknown,
  fetcher: typeof fetch = fetch,
) {
  const apiUrl = `${resolveApiOrigin(configuredOrigin)}/api`;

  async function postAuth(path: "login" | "register", credentials: Credentials) {
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

  async function getJson<T>(path: string): Promise<T> {
    const response = await fetcher(`${apiUrl}/${path}`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new ApiRequestError(response.status);
    }

    return (await response.json()) as T;
  }

  async function postJson<T>(path: string, payload: unknown): Promise<T> {
    const response = await fetcher(`${apiUrl}/${path}`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new ApiRequestError(response.status);
    }

    return (await response.json()) as T;
  }

  return {
    login: (username: string, password: string) =>
      postAuth("login", { username, password }),
    register: (username: string, password: string) =>
      postAuth("register", { username, password }),
    getIngredients: () => getJson<IngredientCatalogResponse>("getIngredients"),
    generateWeekProgram: (preferences: WeekProgramPreferences) =>
      postJson<WeekProgramResponse>("generateWeekProgram", preferences),
    getWeekProgram: () => getJson<WeekProgramResponse>("weekProgram"),
    getGeneratedRecipes: () => getJson<RecipeGroups>("generatedRecipes"),
    generateRecipesFromIngredients: (ingredients: string[]) =>
      postJson<RecipeGroups>("generateRecipesFromIngredients", { ingredients }),
    getShoppingList: () => getJson<ShoppingListResponse>("shoppingList"),
    generateShoppingList: (
      availableIngredients: string[],
      sources?: ShoppingListSourceSelection,
    ) =>
      postJson<ShoppingListResponse>("generateShoppingList", {
        availableIngredients,
        ...(sources ? { sources } : {}),
      }),
  };
}

function configuredOrigin(): unknown {
  return Constants.expoConfig?.extra?.eatUpApiOrigin;
}

export function resolveApiImageUrl(image: string | undefined): string | undefined {
  if (!image?.trim()) {
    return undefined;
  }

  let origin: string;
  try {
    origin = resolveApiOrigin(configuredOrigin());
  } catch {
    return undefined;
  }

  try {
    const url = new URL(image, origin);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export const eatUpAuthApi = {
  login: (username: string, password: string) =>
    createEatUpAuthApi(configuredOrigin()).login(username, password),
  register: (username: string, password: string) =>
    createEatUpAuthApi(configuredOrigin()).register(username, password),
};

export const eatUpApi = {
  getIngredients: () =>
    createEatUpAuthApi(configuredOrigin()).getIngredients(),
  generateWeekProgram: (preferences: WeekProgramPreferences) =>
    createEatUpAuthApi(configuredOrigin()).generateWeekProgram(preferences),
  getWeekProgram: () =>
    createEatUpAuthApi(configuredOrigin()).getWeekProgram(),
  getGeneratedRecipes: () =>
    createEatUpAuthApi(configuredOrigin()).getGeneratedRecipes(),
  generateRecipesFromIngredients: (ingredients: string[]) =>
    createEatUpAuthApi(configuredOrigin()).generateRecipesFromIngredients(
      ingredients,
    ),
  getShoppingList: () =>
    createEatUpAuthApi(configuredOrigin()).getShoppingList(),
  generateShoppingList: (
    availableIngredients: string[],
    sources?: ShoppingListSourceSelection,
  ) =>
    createEatUpAuthApi(configuredOrigin()).generateShoppingList(
      availableIngredients,
      sources,
    ),
};
