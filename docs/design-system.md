# Design System Playbook

This document codifies the Ora UI foundation so every engineer knows where to look for tokens, how to compose canonical components, and which guardrails are enforced in CI.

## Tokens & Global Styles

| Category                                    | Source of Truth                        | Notes                                                                                                                                                                                            |
| ------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Colors, typography, spacing, radii, shadows | `styles/tokens.css` (light/dark)       | Primitive palette values (`--color-*`) flow into semantic tokens (`--background`, `--primary`, `--surface-highlight`, `--state-focus-ring`, etc.) that power Tailwind via `src/app/globals.css`. |
| Tailwind theme bridge                       | `tailwind.config.ts`                   | Maps Tailwind color/font keys to CSS variables so utilities like `bg-primary` and `text-muted-foreground` just proxy the token file.                                                             |
| Global layout helpers                       | `src/components/layout/page-shell.tsx` | `PageShell`, `PageHeader`, `PageBody`, `PageGrid`, `Stack`, and `Cluster` encapsulate responsive padding, spacing, and alignment; avoid re-declaring `flex flex-col gap-*` in feature code.      |
| Non-DOM contexts                            | `src/lib/design-tokens.ts`             | Server-rendered HTML (PDF/email) imports the same palette + spacing constants to stay in sync with CSS variables.                                                                                |

### Token Update Workflow

1. **Propose** via RFC (see Governance) with screenshots + WCAG contrast data.
2. **Update** `styles/tokens.css` and run `npm run lint:css` to ensure Stylelint coverage.
3. **Sync** non-DOM references (`src/lib/design-tokens.ts`) and Storybook token stories.
4. **Verify** visually via `npm run test:visual -- --update-snapshots` and release notes.

## Component Primitives & Usage

| Primitive                          | Location                                         | When to use                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Buttons, inputs, cards, tabs, etc. | `src/components/ui/**`                           | All new UI work should use these shadcn-based primitives (already wired to tokens & variant props).                                                             |
| Page scaffolding                   | `src/components/layout/page-shell.tsx`           | Wrap App Router pages with `PageShell`, place hero copy/actions inside `PageHeader`, and render core content inside `PageBody`.                                 |
| Dialog primitives                  | `src/components/ui/dialog.tsx`                   | Use `DialogContent` for default modals; reach for `LargeDialogContent` when wide/long forms need scrollable bodies without clobbering overflow guardrails.      |
| Domain modules                     | `src/components/{bills,leases,monthly-logs,...}` | Consume primitives only; removal of inline hex colors and bespoke spacing is tracked via Phase 2 migration.                                                     |
| Storybook coverage (interim)       | `src/app/ui-kit` + `src/app/ui-components-demo`  | This route acts as our gallery until Storybook gets wired. When Storybook lands, migrate these demos into `stories/**` and gate `npm run storybook:test` in CI. |

### Implementation Checklist

- Use semantic Tailwind classes (`bg-primary`, `text-muted-foreground`, etc.).
- Wrap multi-column layouts with `PageGrid` so responsive breakpoints stay consistent.
- When building new patterns, add a UI Kit example and screenshot to `docs/design-system.md` (appendix) until Storybook snapshots replace them.

## Tooling & Automation

| Check                              | Command               | CI                                                                |
| ---------------------------------- | --------------------- | ----------------------------------------------------------------- |
| ESLint                             | `npm run lint`        | ✅ existing                                                       |
| **Stylelint + Tailwind rules**     | `npm run lint:css`    | ✅ added to `ci.yml`                                              |
| **Accessibility smoke (axe-core)** | `npm run test:a11y`   | ✅ added to `ci.yml` (serious/critical violations fail the build) |
| **Visual regression smoke**        | `npm run test:visual` | ✅ added to `ci.yml` comparing deterministic baseline snapshots   |
| Playwright E2E                     | `npm run test`        | ✅ existing                                                       |

> **Note:** Accessibility and visual commands default to running in CI; developers can opt in locally via `PLAYWRIGHT_ACCESSIBILITY=1` or `VISUAL_REGRESSION=1`.

## Code Review Expectations

1. **Design reference:** Every UI-affecting PR must link a Figma frame (or screenshots) and list which tokens/components were touched.
2. **Accessibility proof:** Note whether `npm run test:a11y` passed (include report summary if it fails locally).
3. **Visual delta:** Attach updated visual snapshots or confirm `npm run test:visual` ran with no diffs.
4. **Governance labels:** Tag PRs with `ui-system` so the UI Guild can audit weekly.

The pull request template now includes corresponding checkboxes; missing context = request changes.

## Governance & UI Guild

- **Weekly UI Guild** (Tuesdays): Design, Product, and FE platform review incoming token/component proposals, triage design debt, and assign RFC owners.
- **RFC cadence:** New primitives/tokens require a short RFC (Notion/Markdown) outlining rationale, accessibility data, and migration impact. Reference the RFC ID inside the PR description.
- **Backlog tracking:** All design debt tasks live in the `UI System` Jira board tagged with severity (S0-S3). Add tickets when audits reveal raw colors, bespoke spacing, or missing Storybook coverage.
- **Quarterly audit:** Re-run Phases 0–2 sampling to ensure no regressions slipped in; log findings in `docs/ui-audit-phase-{n}.md`.

## Storybook Roadmap (Short-Term)

While Storybook isn’t live yet, the following steps are required to align with the governance plan:

1. Scaffold Storybook (`npx storybook@latest init`) and ingest tokens via `styles/tokens.css`.
2. Port `ui-kit` demos into stories.
3. Enable `@storybook/addon-a11y` and `@storybook/test-runner` to reuse the same accessibility gate locally.
4. Connect Chromatic (or another visual review service) if the Playwright snapshot suite needs richer coverage.

Until then, rely on the Playwright smoke suites plus manual review screenshots.

---

**TL;DR:** Tokens live in `styles/tokens.css`, components live in `src/components/ui` + `page-shell`, tooling enforces Stylelint + axe + visual snapshots in CI, and the UI Guild owns the RFC/backlog process. Keep this document updated when tokens/components/tooling evolve.
