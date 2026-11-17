# Implementation Plan: Remaining EatUp Mobile Pages

**Date**: 2026-11-16 | **Spec**: `spec.md`

## Summary

Implement the three missing user journeys in the existing Expo app: recipe discovery from selected ingredients, weekly meal-program generation, and shopping-list generation. Preserve the existing Express routes, request/response field names, cookie transport, and Expo API-origin validation. Keep login, registration, and backend code unchanged.

## Technical Context

**Language/Version**: TypeScript, strict mode  
**Primary Dependencies**: Expo SDK 58, Expo Router, React Native, Jest, React Native Testing Library  
**Storage**: Existing backend persistence through the current REST API; no client database  
**Testing**: Jest/React Native Testing Library, `npx tsc --noEmit`, `npx expo lint`  
**Target Platform**: iOS, Android, and Expo web  
**Performance Goals**: Keep requests user-triggered where generation incurs AI cost; do not auto-retry generation calls  
**Constraints**: Preserve API paths and JSON field names; use HTTPS API origin and `credentials: include`; do not edit backend or auth screens.

## Constitution Check

- Mobile-first and cross-platform components: PASS.
- Existing backend routes, payloads, and authentication contract preserved: PASS.
- Secrets/database configuration excluded from client and artifacts: PASS.
- Loading, empty, validation, and error states represented: PASS.
- Login and registration unchanged: PASS.
- Existing dependencies and conventions reused: PASS.

## Applied Guidelines

- No matching Angular-to-React-Native transformation guideline was present.
- Apply source-anchored behavior from the three Angular page components/templates and shared service.
- Follow the existing Expo Router and native component patterns in `src/app/` and `src/services/`.

## Implementation Steps

### Step 1: Shared API and ingredient selection
- **Requirements**: REQ-002, REQ-009
- **Design inputs**: `artifacts/wire_contracts.yaml`, `artifacts/shared_modules.yaml`, `artifacts/seams.yaml`
- **Description**: Extend the typed mobile API module for catalog, program, recipe, and shopping-list calls. Add one reusable ingredient picker with accent-insensitive search, expandable categories, and controlled selection. Preserve endpoint names, payload fields, HTTPS validation, and credential inclusion.

### Step 2: Recipe discovery (US1, P1)
- **Requirements**: REQ-002, REQ-003, REQ-004
- **Design inputs**: `artifacts/units/ingredient_recipes/behavior.yaml`, `artifacts/units/ingredient_recipes/bindings.yaml`, `artifacts/wire_contracts.yaml`
- **Description**: Add the Expo route, catalog and saved-recipe loading, selected ingredient chips, authenticated generation, the three recipe groups, image fallback, and loading/error/empty states.

### Step 3: Weekly program (US2, P2)
- **Requirements**: REQ-005, REQ-006
- **Design inputs**: `artifacts/units/week_program/behavior.yaml`, `artifacts/units/week_program/bindings.yaml`, `artifacts/data-model.md`, `artifacts/wire_contracts.yaml`
- **Description**: Add the preference form, validation, saved-program/preferences loading, seven-day/four-meal display, and loading/error/empty states.

### Step 4: Shopping list (US3, P3)
- **Requirements**: REQ-007, REQ-008
- **Design inputs**: `artifacts/units/shopping_list/behavior.yaml`, `artifacts/units/shopping_list/bindings.yaml`, `artifacts/data-model.md`, `artifacts/wire_contracts.yaml`
- **Description**: Add saved-list and catalog loading, pantry selection, generated category/item rendering, source indicators, check/uncheck, select-all/reset, and accurate counts.

### Step 5: Home navigation and verification
- **Requirements**: REQ-001, REQ-009
- **Design inputs**: `artifacts/migration_boundary.yaml`, `artifacts/cross_unit_state.yaml`
- **Description**: Link Home actions to the new routes while preserving the existing signed-out path to login. Run screen/service tests, TypeScript, and lint. Do not edit `Server/server.ts`.

## Project Structure

```text
src/
  app/
    index.tsx
    week-program.tsx
    ingredients-recipes.tsx
    lista-spesa.tsx
  components/
    ingredient-picker.tsx
  services/
    eatup-api.ts
  __tests__/
    eatup-api.test.ts
    ingredient-picker.test.tsx
    week-program.test.tsx
    ingredients-recipes.test.tsx
    lista-spesa.test.tsx
    home.test.tsx
```

## Testing Strategy

- **appType**: Mobile app with a remote REST backend.
- **Critical user journeys**:
  1. Search/select ingredients and render grouped recipe results.
  2. Submit nutrition preferences and render a saved/generated week.
  3. Generate, check, select-all, and reset shopping-list items.
- **primaryValidationStack**: Jest, React Native Testing Library, TypeScript, Expo lint.
- **fallbackMatrix**:
  - `infra-tier`: Mocked API responses for deterministic UI tests; authenticated live API smoke test only when the server is available.
  - `browser-tier`: Component tests are primary; manual Expo device/web smoke test is optional when a runtime is available.
- **Environment requirements**: Node dependencies already installed; no database/container needed for unit tests.
- **knownGaps**: Mocked tests do not validate MongoDB, Groq credentials, or native cookie persistence against a live server.
- **Test data strategy**: Fixed catalog/program/recipe/list JSON fixtures; no real user credentials.
- **Acceptance criteria**: All focused tests, existing tests, TypeScript checking, and lint pass; each route preserves its specified loading, validation, and error behavior.
- **Validation review expectations**: Confirm only mobile files and this feature's traceability artifacts changed; confirm backend/auth screens are untouched and endpoint payloads match wire contracts.

## Task Breakdown

### Phase 1: Shared API and ingredient selection

- [ ] T001 [Plan:1.1] Add focused tests for the ingredient/program/recipe/shopping API methods in `src/__tests__/eatup-api.test.ts`.
- [ ] T002 [Plan:1.1] Add typed API methods and response models in `src/services/eatup-api.ts` [Source: ../Progetto_EatUp/Client/Client_EatUp/src/app/services/common-service.ts#getIngredients,generateWeekProgram,getWeekProgram,generateRecipesFromIngredients,getGeneratedRecipes,generateShoppingList,getShoppingList] [Source: ../Progetto_EatUp/Client/Client_EatUp/src/app/services/data-storage-services.ts#inviaRichiesta].
- [ ] T003 [Plan:1.1] Add search/selection behavior tests in `src/__tests__/ingredient-picker.test.tsx`.
- [ ] T004 [Plan:1.1] Implement the reusable picker in `src/components/ingredient-picker.tsx` [Source: ../Progetto_EatUp/Client/Client_EatUp/src/app/ingredients-recipes/ingredients-recipes.ts#toggleIngredient,isSelected,getVisibleIngredients,normalizeSearch] [Source: ../Progetto_EatUp/Client/Client_EatUp/src/app/lista-spesa/lista-spesa.ts#toggleIngredient,getVisibleIngredients,normalizeSearch].

### Phase 2: User Story 1 - Find recipes from pantry ingredients (P1)

- [ ] T005 [US1] [Plan:2.1] Add recipe-screen tests in `src/__tests__/ingredients-recipes.test.tsx`.
- [ ] T006 [US1] [Plan:2.1] Implement the ingredient-recipes route in `src/app/ingredients-recipes.tsx` [Source: ../Progetto_EatUp/Client/Client_EatUp/src/app/ingredients-recipes/ingredients-recipes.ts#ngOnInit,loadSavedRecipes,generateRecipes,normalizeRecipeGroups,normalizeRecipe] [Source: ../Progetto_EatUp/Client/Client_EatUp/src/app/ingredients-recipes/ingredients-recipes.html].

### Phase 3: User Story 2 - Generate and review a weekly meal program (P2)

- [ ] T007 [US2] [Plan:3.1] Add weekly-program screen tests in `src/__tests__/week-program.test.tsx`.
- [ ] T008 [US2] [Plan:3.1] Implement the weekly-program route in `src/app/week-program.tsx` [Source: ../Progetto_EatUp/Client/Client_EatUp/src/app/week-program/week-program.ts#ngOnInit,loadSavedWeekProgram,onSubmit,normalizeProgram,populatePreferences] [Source: ../Progetto_EatUp/Client/Client_EatUp/src/app/week-program/week-program.html].

### Phase 4: User Story 3 - Build and check a shopping list (P3)

- [ ] T009 [US3] [Plan:4.1] Add shopping-list screen tests in `src/__tests__/lista-spesa.test.tsx`.
- [ ] T010 [US3] [Plan:4.1] Implement the shopping-list route in `src/app/lista-spesa.tsx` [Source: ../Progetto_EatUp/Client/Client_EatUp/src/app/lista-spesa/lista-spesa.ts#ngOnInit,loadSavedShoppingList,loadIngredients,generateShoppingList,setAllChecked,normalizeShoppingList] [Source: ../Progetto_EatUp/Client/Client_EatUp/src/app/lista-spesa/lista-spesa.html].

### Phase 5: Navigation and verification

- [ ] T011 [Plan:5.1] Update Home navigation tests in `src/__tests__/home.test.tsx`.
- [ ] T012 [Plan:5.1] Link Home actions to the three routes in `src/app/index.tsx`.

## Requirement Mapping

| REQ ID | Description | Plan Items | Implementation Evidence |
|--------|-------------|------------|------------------------|
| REQ-001 | Provide routes and Home navigation | 5.1 | `src/app/index.tsx`, route screens |
| REQ-002 | Search/select ingredients | 1.1, 2.1 | `src/components/ingredient-picker.tsx`, recipe route |
| REQ-003 | Generate and display recipe groups | 2.1 | `src/app/ingredients-recipes.tsx`, API service |
| REQ-004 | Load saved recipes and guard generation | 2.1 | `src/app/ingredients-recipes.tsx` |
| REQ-005 | Load/save weekly preferences and program | 3.1 | `src/app/week-program.tsx`, API service |
| REQ-006 | Validate and display weekly results | 3.1 | `src/app/week-program.tsx` |
| REQ-007 | Load/generate categorized shopping list | 4.1 | `src/app/lista-spesa.tsx`, API service |
| REQ-008 | Check items, counts, and guards | 4.1 | `src/app/lista-spesa.tsx` |
| REQ-009 | Preserve API/security contract | 1.1, 5.1 | `src/services/eatup-api.ts`, API tests |
