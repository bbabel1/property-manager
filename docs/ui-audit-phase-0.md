# UI Audit — Phase 0 Discovery

Phase 0 establishes a single baseline for tokens, typography, and UI entry points so later remediation can focus on deltas instead of archaeology. This document captures the current sources of truth, inventories every UI surface that renders user-facing styling, and outlines the alignment sessions needed to confirm scope and known deviations.

---

## 1. Token, Typography, and Global Style Sources

| Source | Location | Scope | Notes / Expected Values | Gaps & Follow-ups |
| --- | --- | --- | --- | --- |
| CSS variable tokens | `styles/tokens.css:1-247` | Primitive palette (grays, brand slate, action blue, semantic status), semantic surfaces, spacing (`--space-*`), typography scale, radii, shadows, z-indices, chart palette | Primary CTA blue `#164AAC` (`--color-action-400`, line 38) drives `--primary`/`--ring`; spacing increments mirror 4px grid (`--space-1`..`--space-24`, lines 129-141); typography ties to `--text-scale-factor` and Source Sans weights (`--font-weight-normal/medium`, lines 147-162) | Dark-mode overrides exist but no token comments on accessibility min contrast; need to reconcile with Figma light/dark specs and document ownership |
| Tailwind theme extension | `tailwind.config.ts:1-82` | Maps Tailwind semantic color keys, font sizes, radii, and fonts to CSS variables | `content` still references `./src/pages/**` even though routing lives in `src/app/**`; ensure analyzers include new dirs; font scale locked to tokenized `--text-*` sizes, so updating CSS variables cascades here | Add plugin (e.g., `@tailwindcss/animate`) if required by Figma motion spec; confirm whether `sidebar.*` tokens need Tailwind utilities for hover/active states |
| Global stylesheet & theme glue | `src/app/globals.css:1-200` | Imports tokens, defines CSS custom properties consumed by `@theme inline`, sets base typography, custom utility hooks (sidebar, drag states) | Ensures every element inherits `border-border` and `bg-background`; declares `@custom-variant dark` so class-based dark mode matches tokens; base typography ties headings/body to Source Sans loaded in `layout.tsx` (`src/app/layout.tsx:1-34`) | Need explicit documentation for custom helpers (`.sidebar-submenu`, `.bill-trash-container`, `.monthly-log-card`) because they bypass Tailwind and may diverge from design tokens |
| Component-level token usage | `src/components/ui/button.tsx:1-54` (and other shadcn-derived primitives under `src/components/ui/**`) | Buttons, cards, tabs, etc., consume Tailwind classes referencing semantic color names | Confirms the UI kit expects semantic tokens (`bg-primary`, `text-muted-foreground`, etc.) rather than raw hex values, so aligning tokens propagates; variant coverage: default, destructive, outline, secondary, ghost, action, link, cancel | Need audit of remaining components for stray hard-coded colors (e.g., `text-success` that maps to `--color-success-500` but may still use manual hex); can automate via eslint/stylelint |
| Figma library | _Buildium Design System (request latest file/branch from Design)_ | Canonical reference for colors, typography, motion, spacing, interactive states, iconography | Expectation: light/dark palettes match CSS variables above (e.g., `Brand Blue / 500 #164AAC`), spacing uses 4px base, Source Sans 3 as primary type | Action: confirm which Figma library version is authoritative (e.g., “Buildium DS 2.1”) and export token JSON for automated checks; add link + owner in this doc once design shares it |

### Observations
- Tokens already distinguish primitive and semantic values; future consolidation should keep primitive palette in `styles/tokens.css` and export machine-readable tokens (Style Dictionary) for Storybook/theming parity.
- `Source_Sans_3` is loaded globally in `src/app/layout.tsx:1-34`, matching typography tokens; confirm whether headings require alternate weights (`700`) before removing them from Google Font load.
- No repo-managed process enforces parity between CSS tokens and Figma, so part of Phase 1 should include an automated diff (e.g., token JSON import) to catch drift.

---

## 2. UI Entry Point Inventory

### 2.1 App Router Surfaces (`src/app/**`)

| Area | Route(s) / File(s) | Primary Components & Styling | Design Notes / References |
| --- | --- | --- | --- |
| Dashboard | `src/app/(protected)/dashboard/page.tsx:1-200` | Uses shadcn `Card`, `Badge`, `Button` with Tailwind utilities (`grid`, `text-foreground`, `bg-primary/10`) | Matches Buildium home overview (KPIs, renewals, alerts); ensure KPI cards follow tokenized chart colors |
| Properties list | `src/app/(protected)/properties/page.tsx:1-200` | Tailwind tables/forms plus shared UI primitives (`Card`, `Button`, `Input`, `Select`, `Switch`); stateful filters & modals | Should mirror Buildium “Properties” grid; relies heavily on tokens for typography, spacing |
| Property detail hub | `src/app/(protected)/properties/[id]/**/page.tsx` | Breaks into summary, financials, files, tasks, units; composes modules from `src/components/property/*` | Each sub-route should map to Buildium tab spec; confirm nav/spacing parity |
| Units list/detail | `src/app/(protected)/units/page.tsx`, `[id]/page.tsx` | Combines `src/components/unit/**` cards with tokens for rent/service panels | Reference Buildium “Units” screens for stage indicators |
| Owners | `src/app/(protected)/owners/page.tsx`, `[id]/page.tsx` | Uses owner summary cards, inline edit patterns from `src/components/owners` (via `src/components/tenants`/shared forms) | Needs alignment on inline editing micro-states (muted backgrounds, focus rings) |
| Tenants | `src/app/(protected)/tenants/page.tsx`, `[id]/page.tsx` | Re-uses inline edit cards, file panels, notes tables; heavy reliance on `Card`, `Tabs`, `Table` components | Align with Buildium tenant profile spec; ensure status pills use semantic tokens |
| Vendors | `src/app/(protected)/vendors/page.tsx`, `[vendorId]/page.tsx` | Leverages `src/components/vendors/**` for AI panel, schedule, summary; mix of cards + timeline styles | Validate new AI panel colors vs. brand guidelines |
| Files | `src/app/(protected)/files/page.tsx` + `src/components/files/**` | Table-heavy view with filters, dialogs, upload flows; uses tokens for state chips, row highlights | Compare to documentation in `docs/FILES_PAGE_IMPLEMENTATION_PLAN.md` for fidelity |
| Bills & Financials | `src/app/(protected)/bills/**/page.tsx`, `src/components/bills/**`, `src/components/financials/**` | Complex forms and tables; custom CSS hooks in `globals.css` for trash buttons | Need to standardize spacing/padding with tokens; confirm destructives align with warning/danger tokens |
| Accounting / Reconciliations | `src/app/(protected)/accounting/gl-sync/page.tsx`, `src/app/(protected)/reconciliations/**`, `src/components/reconciliations/**` | Stepper-like flows, form panels, progress indicators | Map to Buildium reconciliation wizards; confirm stage colors meet accessibility |
| Monthly Logs | `src/app/(protected)/monthly-logs/**`, `src/components/monthly-logs/**` | Multi-stage workflow with drag/drop, cards, stage navigation; custom `.monthly-log-card` class hooks | Needs design sign-off on drag-state opacity + stage chips |
| Maintenance & Tasks | `src/app/(protected)/maintenance/**`, `src/app/(protected)/tasks/**`, `src/components/tasks/**` | Wizards & form panels for new tasks; uses action buttons + nav tabs | Validate iconography + severity pills vs. Buildium spec |
| Bank Accounts & Rent | `src/app/(protected)/bank-accounts/**`, `src/app/(protected)/rent/page.tsx` | Financial tables, CTA buttons, summary stats | Ensure financial data uses monospace tokens if required by Figma |
| Settings & Staff | `src/app/(protected)/settings/**`, `src/app/(protected)/staff/page.tsx` | Form-heavy screens using `Input`, `Switch`, `Select`, `Tabs` | Confirm form spacing + helper text align with design tokens |
| Auth flows | `src/app/auth/page.tsx`, `signin/page.tsx`, `signup/page.tsx`, `/page.tsx` landing | Minimal forms referencing `Card`, `Input`, `Button`; rely on tokens for backgrounds and accent states | Need marketing/brand alignment (illustrations, typography sizes) from Figma |
| UI sandboxes | `src/app/ui-kit/page.tsx`, `ui-components-demo/page.tsx`, `test*` routes | Playground surfaces used to demo tokens/components | Ensure these continue reflecting “expected values” for regression checks; document gating for production |

**Notes**
- There is no `src/pages` directory even though Tailwind content config references it; the canonical routing is entirely App Router (`src/app`). Update analyzers to prevent missing classes during build-time purges.
- Layout, providers, and middleware live under `src/app/layout`, `src/components/client-providers.tsx`, `src/middleware.ts`. These should be part of future audits if shared wrappers inject styling (e.g., theme providers).

### 2.2 Shared Component Libraries (`components/**`, `src/components/**`)

| Module | Location(s) | Description & Styling Approach | Design Alignment |
| --- | --- | --- | --- |
| Legacy properties modal | `components/properties/NewPropertyModal.tsx` | Older component (pre `@/components` migration); mixes Tailwind + inline styles | Determine if still referenced; if deprecated, migrate to new modal system |
| Global modals & autocomplete | `src/components/AddPropertyModal.tsx`, `GooglePlacesAutocomplete.tsx`, etc. | Compose `Dialog`, `Form`, and Tailwind utilities; some components duplicate functionality present in new UI kit | Evaluate for consolidation into canonical primitives before Phase 2 |
| `src/components/ui/**` | `button.tsx`, `card.tsx`, `input.tsx`, etc. | Shadcn-style primitives parameterized via `class-variance-authority`; rely purely on semantic Tailwind classes | Treat as source of truth for component states; ensure tokens cover every variant (badge, tabs, table, nav tabs, sidebar) |
| Layout system | `src/components/layout/PageHeader.tsx`, `app-sidebar.tsx`, `DataTable.tsx` | Establish page scaffolding, navs, meta stats; heavy use of `Card`, `Tabs`, icons | Align with Buildium shell chrome spec (sidebar width, typography) defined in tokens/globals |
| Domain modules | `src/components/bills/**`, `monthly-logs/**`, `leases/**`, `property/**`, `tasks/**`, `vendors/**`, etc. | Feature-specific composites referencing primitives + tokens; often contain custom CSS hooks (e.g., `bill-trash-container`) | Need per-module audits to eliminate hard-coded spacing/colors and backfill Storybook coverage |
| Form system | `src/components/form/InlineEditCard.tsx`, `form-status.tsx`, `forms/types.ts` | Inline edit patterns, validation UI; only Storybook story currently covers `InlineEditCard` (`stories/InlineEditCard.stories.tsx`) | Expand Storybook to cover additional form states (error, success, disabled) per Figma spec |

### 2.3 Storybook Coverage (`stories/**`)

| Story | File | Component | Notes |
| --- | --- | --- | --- |
| Inline Edit Card | `stories/InlineEditCard.stories.tsx:1-34` | `src/components/form/InlineEditCard` | Only Storybook entry; demonstrates edit vs. view states but lacks token-driven controls (no dark mode, no density variants). Need additional stories for cards, tables, nav tabs, etc., to match audit requirements. |

---

## 3. Stakeholder Alignment Sessions

| Session | Participants | Objectives | Pre-work / Inputs | Output |
| --- | --- | --- | --- | --- |
| Token & Typography Baseline Review | Design lead, Design Ops, FE platform owner | Validate that `styles/tokens.css` values and Tailwind mappings match the latest Figma library; agree on owners/change process | This document, Figma token export, accessibility benchmarks | Signed-off token table + action list for missing tokens (e.g., motion, elevation) |
| Surface Inventory Walkthrough | Product leads for Properties/Accounting/Maintenance, FE module owners | Confirm inventory completeness, flag priority surfaces, capture known gaps or upcoming redesigns | Section 2 tables, traffic/usage analytics (if available) | Prioritized list of surfaces for Phase 1–2 remediation with engineering POCs |
| Scope & Governance Alignment | Design lead, Product director, Eng manager, QA/A11y rep | Define audit success criteria, timelines, and governance hooks (linting, Storybook regression, release checkpoints) | Outputs from previous two sessions, CI/tooling capabilities | Agreed roadmap (Phases 1–4), meeting cadence (e.g., weekly UI Guild), owners per workstream |

### Scheduling Recommendations
1. Book Token review within 1 week to unblock any immediate token refactors needed for in-flight UI changes.
2. Run surface walkthrough as a 60–90 minute working session with module demos so product/design can point out visual debt quickly.
3. Use scope/governance session to lock in tooling budget (Stylelint, visual regression) and ensure QA/a11y are part of the acceptance process.

---

## Next Actions
1. Circulate this document for async comments (Design/Product/Eng) and capture outstanding Figma links/owners.
2. Update Tailwind `content` globs and Storybook coverage plan as part of Phase 1 kick-off so analyzers reflect the true surface area.
3. Stand up a shared tracking board (Notion/Jira) that mirrors the inventory above, tagging each surface with severity, owner, and planned remediation phase.

