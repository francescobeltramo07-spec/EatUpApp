# Architecture Index

## Implementation Guide

This index is not the full contract. Do not implement from this file alone; follow the artifact paths below.

### Global artifacts

- `unit_graph.yaml`: boundaries, entry points, dependencies, and shared references.
- `migration_boundary.yaml`: implementation scope; use `must_rewrite`, not `source_anchors`.
- `wire_contracts.yaml`: exact request, response, error, and authentication contracts; filter by `unit`.
- `shared_modules.yaml`: shared source service responsibilities; filter `used_by_units`.
- `cross_unit_state.yaml`: session-cookie flows; filter `writer.unit` or `reader.unit`; verify runtime-marked flows.
- `seams.yaml`: frozen backend rule and API bridge mapping.
- `data-model.md`: persisted and wire data shapes used by the screens.

### Unit: week_program

- Trigger: `/week-program`.
- Read `units/week_program/behavior.yaml` for form validation, loading, saved preferences, and errors.
- Read `units/week_program/bindings.yaml` for route and API wiring.
- Read `units/week_program/unit_decomposition.yaml` for advisory split candidates only.
- Filter `wire_contracts.yaml` for `unit: week_program`; filter shared/state artifacts by unit.
- Completion evidence: screen tests, typecheck, app tests, and an authenticated runtime request when credentials/environment permit.

### Unit: ingredient_recipes

- Trigger: `/ingredients-recipes`.
- Read `units/ingredient_recipes/behavior.yaml` for catalog search/selection, recipe groups, and errors.
- Read `units/ingredient_recipes/bindings.yaml` for route and API wiring.
- Read `units/ingredient_recipes/unit_decomposition.yaml` for advisory split candidates only.
- Filter `wire_contracts.yaml` for `unit: ingredient_recipes`; filter shared/state artifacts by unit.
- Completion evidence: picker/screen tests, typecheck, app tests, and API runtime checks when available.

### Unit: shopping_list

- Trigger: `/lista-spesa`.
- Read `units/shopping_list/behavior.yaml` for saved list, pantry selection, checking, totals, and errors.
- Read `units/shopping_list/bindings.yaml` for route and API wiring.
- Read `units/shopping_list/unit_decomposition.yaml` for advisory split candidates only.
- Filter `wire_contracts.yaml` for `unit: shopping_list`; filter shared/state artifacts by unit.
- Completion evidence: screen tests, typecheck, app tests, and API runtime checks when available.
