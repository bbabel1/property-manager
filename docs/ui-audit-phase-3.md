# UI Audit — Phase 3 Documentation, Tooling & Governance

Phase 3 closes the loop by writing down the rules, adding CI guardrails, and updating team processes so design consistency persists after the initial audit.

## 1. Design System Documentation
- Authored `docs/design-system.md`, covering:
  - Token sources (`styles/tokens.css`, Tailwind bridge, server-safe exports).
  - Component primitives (`src/components/ui/**`, `page-shell` layouts) and usage guidelines.
  - Tooling table (ESLint, Stylelint, accessibility, visual smoke) with mapped npm scripts.
  - Governance expectations (UI Guild cadence, RFC workflow, backlog tracking).
- Document now serves as the single onboarding reference for engineers + reviewers.

## 2. Automated Checks (CI Gating)
- Added Stylelint with Tailwind-aware config (`stylelint.config.mjs`) plus `npm run lint:css`.
- Created Playwright-based accessibility smoke test leveraging `@axe-core/playwright`.
- Added deterministic visual regression smoke test with committed screenshot baseline.
- `ci.yml` now runs `lint:css`, `test:a11y`, and `test:visual` alongside existing lint/type/test steps, blocking PRs on failures.

## 3. Review Template & Governance Hooks
- Updated `.github/pull_request_template.md` to require:
  - Linked Figma/screenshot references for any UI change.
  - Accessibility test status (`npm run test:a11y`).
  - Visual regression confirmation (`npm run test:visual` / snapshot diffs).
- Documented UI Guild / RFC cadence inside the design-system guide so product/design/engineering have a shared, reviewable process.

## 4. Storybook & Backlog Tracking (Forward-looking)
- While Storybook isn’t live, the design system doc outlines the steps (init, token wiring, addons) and calls for moving `ui-kit` demos into stories.
- Added guidance for tagging PRs with `ui-system` and tracking debt items on the UI System board, ensuring future regression work lands on a shared backlog.

**Result:** Phases 0–2 instrumentation now has written policy + CI enforcement. Any token/component change must document design context, pass Stylelint + axe + visual checks, and flow through the UI Guild for approval.

