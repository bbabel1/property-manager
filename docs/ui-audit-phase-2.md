# UI Audit — Phase 2 Component & Layout Consolidation

Phase 2 focused on collapsing duplicated layout patterns into canonical primitives, migrating high-traffic pages to the shared system, and deleting the legacy `.page-*` utility classes to prevent future divergence.

---

## 1. Shared Layout & Spacing Primitives

File: `src/components/layout/page-shell.tsx:1-164`

- Introduced `PageShell`, `PageHeader`, `PageBody`, `PageSection`, and `PageGrid` so every page can compose a consistent shell (padding, spacing, responsive breakpoints) without bespoke wrappers.
- Added `Stack` (vertical layout with tokenized gap scale) and `Cluster` (horizontal/inline grouping with controlled wrapping) to replace ad-hoc `flex flex-col gap-*` and `flex flex-wrap` snippets. Gaps map to the same spacing scale used in tokens, ensuring consistent visual rhythm.
- The new primitives encapsulate hover/focus-safe typography and support variant props (e.g., `PageGrid columns={4}`) so consuming modules toggle density without rewriting grid classes.

---

## 2. Module Migrations to Canonical Components

### Dashboard

- File: `src/app/(protected)/dashboard/page.tsx:13-270`
- Adopted `PageShell` + `PageHeader` for the hero section and replaced the top-level layout with `PageBody` + `Stack`.
- Converted the KPI row into a `PageGrid columns={4}` and wrapped subsequent content blocks in the same stack, ensuring uniform spacing between cards/sections.
- Error banner now lives inside the shared stack, maintaining consistent padding and focus order.

### Properties List

- File: `src/app/(protected)/properties/page.tsx:13-351`
- Migrated header/action bar to `PageHeader` and wrapped the view in `PageBody`.
- Replaced legacy filter rows with `Stack`/`Cluster` combinations, which aligns dropdowns, search, and toggles on the same gap scale.
- Inline detail blocks (owners, address) now use `Stack` to mirror the vertical spacing tokens; account status pills reuse `Cluster` so pill spacing/fonts align with the design system.

### Sidebar Layout

- File: `src/components/layout/app-sidebar.tsx:360-436`
- Removed `.page-header`/`.page-content` wrappers in favor of a sticky toolbar (`flex h-12 ...`) and a plain `bg-background` content inset.
- Pages now own their padding via `PageBody`, eliminating implicit spacing that prevented consolidation.

---

## 3. Retirement of Legacy Utilities

- Removed `.page-header`, `.page-content`, `.page-container`, and `content-grid*` definitions from `src/app/globals.css:274-280`, completing the deprecation of the custom BEM-like classes referenced in Phase 0/1.
- Because the only remaining consumers (Dashboard and Properties) now use the new primitives, deleting the CSS ensures no future components rely on undocumented helpers.

---

## 4. Next Steps

1. Migrate the remaining high-traffic pages (`owners`, `tenants`, `monthly-logs`) to `PageShell` so the entire protected app benefits from the shared layout semantics.
2. Create Storybook docs for `PageHeader`, `Stack`, and `Cluster`, showcasing approved gap combinations and responsive behaviors.
3. Add an ESLint/TS rule (or codemod) to flag new `.page-*` class introductions, keeping the layout surface confined to the shared primitives.
