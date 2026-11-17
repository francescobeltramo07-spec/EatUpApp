# Existing Data Model Relevant to the Requested Screens

The backend stores user-scoped documents in MongoDB. The frontend consumes JSON shapes; this migration does not alter collections or persistence.

## Ingredient catalog

- Source: `ingredienti` collection, returned by `GET /api/getIngredients`.
- Shape used by the reference client: categories with `categoria` and `ingredienti`; ingredient entries may expose `nome`, `name`, `id`, or `_id`.

## Weekly program

- Source: `weekPrograms` and embedded `users.savedData.weekProgram`.
- Fields consumed: `startDate`, `endDate`, `preferences`, and seven `days`.
- Each day includes an ISO date and `colazione`, `pranzo`, `merenda`, and `cena`.
- Preferences include calories, macros, fiber, food preferences, and intolerances.

## Generated recipes

- Source: `generatedRecipes` and embedded `users.savedData.generatedRecipes`.
- Fields consumed: `groups`, `sourceIngredients`, and update metadata.
- Groups: `soloSelezionati`, `pochiExtra`, and `daComprare`.
- Recipe fields: title, quality, image URL, ingredients, extra ingredients, and description.

## Shopping list

- Source: `shoppingLists` and embedded `users.savedData.shoppingList`.
- Fields consumed: `categories`, `sources`, and generation metadata.
- Each category has `categoria` and `items`; each item has `nome`, `quantita`, and `motivo`.
- `sources` indicates whether recipes and/or a weekly program contributed.
