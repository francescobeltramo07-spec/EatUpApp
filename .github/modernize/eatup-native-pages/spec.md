# Feature Specification: Remaining EatUp Mobile Pages

> Governed by: `./constitution.md`

**Feature Branch**: `eatup-native-pages`  
**Created**: 2026-11-16  
**Status**: Draft  
**Input**: User requested the remaining pages and services from the Angular EatUp client in the React Native app.

## Scope Baseline

- **Discovery method**: Reviewed Angular route declarations, the weekly-program, ingredient-recipes, and shopping-list components/templates, and their shared services.
- **Total items discovered**: 6 routes.
- **Items in scope**: 3 routes: weekly program, ingredient recipes, and shopping list. Home navigation is updated to reach them. Existing login and registration remain unchanged.

## User Scenarios & Testing

### User Story 1 - Find recipes from pantry ingredients (Priority: P1)

As an authenticated user, I want to browse and select ingredients I have and request recipes based on them, so I can decide what to cook.

**Why this priority**: Ingredient-driven recipes are a primary EatUp journey and exercise the shared ingredient catalog service.

**Independent Test**: Load categories, search and select ingredients, then submit and display the returned recipe groups.

**Acceptance Scenarios**:

1. **Given** the ingredient catalog is available, **When** I search with text that includes or omits accents, **Then** matching ingredient categories and names remain discoverable.
2. **Given** I selected at least one ingredient and am signed in, **When** I request recipes, **Then** results appear in the three groups: selected ingredients only, a few extras, and ingredients to buy.
3. **Given** no ingredients are selected or I am signed out, **When** I request recipes, **Then** no generation request is sent and the page explains what is required.
4. **Given** an image cannot load, **When** its recipe card renders, **Then** the card remains usable and shows a fallback.

### User Story 2 - Generate and review a weekly meal program (Priority: P2)

As an authenticated user, I want to enter calorie and nutrition preferences and generate a seven-day meal program, so I can plan meals around my needs.

**Why this priority**: This preserves the existing planner flow and feeds the shopping-list journey.

**Independent Test**: Submit valid preferences, verify a seven-day response with four meals per day, and verify saved-program loading.

**Acceptance Scenarios**:

1. **Given** I am signed in, **When** I open the page, **Then** the saved program and saved preferences are loaded when available.
2. **Given** calories are missing or non-positive, **When** I submit, **Then** the form shows validation and sends no request.
3. **Given** valid preferences, **When** generation succeeds, **Then** the seven dated days and four meals per day are displayed.
4. **Given** loading or generation fails, **When** the request completes, **Then** loading ends and an understandable error or empty state is shown.

### User Story 3 - Build and check a shopping list (Priority: P3)

As an authenticated user, I want a shopping list derived from saved recipes and the weekly program, excluding ingredients I already have, so I can shop efficiently.

**Why this priority**: This completes the end-to-end meal-planning workflow using the saved data from the other journeys.

**Independent Test**: Load saved data, select pantry ingredients, generate a list, then check items and verify the checked/total counts.

**Acceptance Scenarios**:

1. **Given** I am signed in, **When** I open the page, **Then** saved shopping-list data and the ingredient catalog are loaded.
2. **Given** I have a saved recipe or weekly program, **When** I generate the list, **Then** categorized items and source indicators are displayed.
3. **Given** I check or uncheck items, **When** the list updates, **Then** checked and total counts reflect the current state; select-all and reset affect every item.
4. **Given** there is no saved recipe or program, **When** I generate a list, **Then** the page explains that one must be created first.

### Edge Cases

- Catalog or protected API requests fail; loading state ends and a useful message is shown.
- Saved programs, recipe groups, or shopping-list categories are empty or malformed.
- Search has no matches; no stale categories are shown as matches.
- A recipe image is missing or fails; the recipe text remains available.
- The user is signed out; protected data is not requested and login remains reachable.
- AI generation must not be retried automatically.

## Requirements

### Functional Requirements

- **REQ-001**: The app MUST provide navigable mobile routes for the weekly program, ingredient-based recipes, and shopping list.
- **REQ-002**: The app MUST load ingredient categories and support accent-insensitive search, category expansion, and selecting/removing available ingredients.
- **REQ-003**: The app MUST submit selected ingredient names to the existing recipe-generation endpoint and display the three returned recipe groups, quality, ingredients, extras, descriptions, and images where available.
- **REQ-004**: The app MUST load saved recipes for signed-in users and explain why recipe generation is unavailable when signed out or when no ingredient is selected.
- **REQ-005**: The weekly-program screen MUST load the saved program/preferences for signed-in users and submit calorie, macro, fiber, preference, and intolerance fields without renaming them.
- **REQ-006**: The weekly-program screen MUST validate positive calories and display valid seven-day, four-meal results with loading, empty, and error states.
- **REQ-007**: The shopping-list screen MUST load saved list data, submit available ingredient names to the existing endpoint, and show categorized items and recipe/program source indicators.
- **REQ-008**: The shopping-list screen MUST support item checking, select-all, reset, and accurate total/checked counts; signed-out and no-source states MUST be clear.
- **REQ-009**: All API calls MUST preserve existing route paths, payload field names, HTTPS origin validation, and credential inclusion. The backend and authentication screens MUST remain unchanged.

### Key Entities

- **Ingredient category**: A named group of catalog ingredients, each with a display name and optional identifier.
- **Weekly program**: Date range, saved nutrition preferences, and seven daily entries with breakfast, lunch, snack, and dinner.
- **Generated recipe**: Title, quality rating, image, selected ingredients, optional extra ingredients, and description.
- **Shopping list**: Categories of items with quantity and reason, plus indicators of recipe and weekly-program sources.

## Success Criteria

### Measurable Outcomes

- **SC-001**: A signed-in user can reach each of the three pages from Home without entering a URL manually.
- **SC-002**: A valid generated weekly program displays seven days and four meal slots per day.
- **SC-003**: Recipe results are presented in all three named groups, including an empty group when the server returns no recipes for it.
- **SC-004**: Shopping-list totals and checked counts match the rendered items after individual, select-all, and reset actions.
- **SC-005**: Every tested request uses the existing API contract; no backend route, database configuration, or authentication screen changes are required.
- **SC-006**: Unit tests, TypeScript checking, and lint pass for the changed mobile code.
