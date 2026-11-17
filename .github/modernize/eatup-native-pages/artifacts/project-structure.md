# Project Structure

## Project classification

EatUpApp is a React Native/Expo mobile frontend with a colocated Express/MongoDB backend. The reference client is a separate Angular frontend.

## Runtime entry points and layers

- Mobile entry: Expo Router at `src/app/_layout.tsx`; route files are under `src/app/`.
- Mobile screens: home, login, and registration already exist. The requested source journeys are weekly program, recipes from selected ingredients, and shopping list.
- Mobile API layer: `src/services/eatup-api.ts`; it resolves the configured API origin and sends credentialed requests.
- Backend entry: `Server/server.ts`; it provides authentication, ingredient reads, AI generation, and persisted user data.
- Reference entry: Angular routes in `../Progetto_EatUp/Client/Client_EatUp/src/app/app.routes.ts`.
- Reference layers: route components under `src/app/*`; shared HTTP methods in `src/app/services/common-service.ts` and `data-storage-services.ts`.

## Functional domains

- Weekly meal planning and saved program retrieval.
- Ingredient search and recipe generation.
- Shopping list generation from saved recipes/program and available ingredients.
- Authentication is an existing prerequisite and remains unchanged.

## Requested runtime boundary

Only the three missing React Native journeys, shared ingredient selection, typed API calls, and Home navigation are in scope. Existing authentication screens and the backend remain outside the rewrite boundary.
