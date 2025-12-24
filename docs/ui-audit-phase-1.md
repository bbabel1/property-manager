# UI Audit — Phase 1 Token & Global Style Rationalization

<!-- markdownlint-configure-file {"MD013": false, "MD056": false} -->

Phase 1 focused on extracting actual usage, reconciling tokens with the Buildium-approved palette/typography, and backfilling interaction utilities so downstream component work is standardized.

---

## 1. Analyzer Outputs & Baseline Mapping

| Check                | Command / Source                                                                         | Findings                                                                                                                                                           | Action                                                                                                           |
| -------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Raw color extraction | `rg -o "#[0-9A-Fa-f]{6}" src components`                                                 | 42 unique hex codes outside token files (primary offenders: Google Places dropdown, PDF/email templates, `UnitFinancialServicesCard`, statement preview endpoints) | All surfaced instances were mapped to tokens or converted into sanctioned semantic variables (see Sections 2–3). |
| Typography usage     | Review of `src/app/layout.tsx` + `styles/tokens.css` + inline templates                  | App router already loads `Source Sans 3`, but PDF/email templates fell back to Arial/Helvetica; inline statements ignored font scale tokens                        | Introduced `designTokens.typography` bridge for non-DOM contexts and bound statement/email CSS to that stack.    |
| Spacing scale        | Tokens defined (`--space-*`), but server-rendered templates used px literals (8/12/24px) | Added `spacing` entries in `designTokens` (xs–xxxl) and replaced px literals with semantic spacing references.                                                     |

Residual risks: Tailwind `content` globs still include `./src/pages/**`; moving to App Router-only analysis is tracked for Phase 2 so purge/analyzers match actual files.

---

## 2. Token & Semantic Layer Updates

Key additions landed in `styles/tokens.css:66-139`:

- Added popover semantics, inverse text, dropdown/panel/highlight surfaces, and `--surface-*` border helpers so overlays and neutral cards stop inventing bespoke hex values.
- Defined interaction overlays `--state-hover-overlay`, `--state-active-overlay`, and `--state-focus-ring` to centralize hover/active/focus colors.
- Filled previously missing `--popover` tokens referenced by `@theme inline` to prevent fallbacks in `src/app/globals.css:90-150`.

For contexts that cannot read CSS variables (emails, PDFs), `src/lib/design-tokens.ts:1-30` now exports a single TypeScript map mirroring the CSS token values (colors, spacing, typography). This bridges server-rendered HTML with the same palette and ensures future palette tweaks only happen in one place.

---

## 3. Raw Value Remediation

| Area                                   | File / Lines                                                                                                                                                                           | Change                                                                                                                                                                                                |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google Places dropdown & select arrows | `src/app/globals.css:321-360`                                                                                                                                                          | Added `.interactive-surface`/`.focus-ring-token` utilities plus tokenized `.custom-select-arrow` and `.pac-item:hover` so hover/focus states inherit `--state-*` and dropdowns use semantic surfaces. |
| Unit Financial Services UI             | `src/components/unit/UnitFinancialServicesCard.tsx:33-38,617`                                                                                                                          | Replaced `bg-[#f3f7ff]`, `border-blue-200/70` etc. with `var(--surface-highlight)` semantic classes, aligning edit fields with the tokenized highlight surface.                                       |
| Monthly statement HTML (PDF & preview) | `src/components/monthly-logs/MonthlyStatementTemplate.tsx:86-250`, `src/lib/monthly-statement-service.ts:225-269`, `src/app/api/monthly-logs/[logId]/preview-statement/route.ts:40-80` | All inline CSS now references `designTokens` for color, typography, and spacing, ensuring PDFs/previews inherit the same Buildium palette and spacing rhythm.                                         |
| Monthly statement email                | `src/lib/email-service.ts:201-350`                                                                                                                                                     | Email template colors, fonts, and spacing were bound to the same token map, removing ad-hoc Tailwind Slate blues and guaranteeing AA contrast (primary on highlight backgrounds stays ≥4.5:1).        |

Remaining TODOs after Phase 1: run Stylelint against component directories to flag any newly introduced raw values; add Storybook tokens page so designers can diff values visually.

---

## 4. Interaction & Accessibility Utilities

- Global focus/hover/active semantics now live in `styles/tokens.css:116-121`, and Tailwind utilities consume them in `src/app/globals.css:321-342`. Any component can opt into consistent focus rings via `.focus-ring-token` or hover overlays via `.interactive-surface`.
- `.pac-item` hover styles (global Places auto-complete) switched to `--surface-dropdown-hover`, avoiding low-contrast grays on dark overlays.
- `.custom-select-arrow` uses an SVG with `stroke='currentColor'`, so the arrow inherits the muted text token and works in both themes.

These utilities keep hover/focus colors within the same contrast-tested palette as buttons (`--state-focus-ring` matches `--ring`, ensuring 3:1 contrast against both light/dark surfaces).

---

### Next Steps

1. Wire `designTokens` into future React-to-HTML serialization so the PDF generator no longer depends on the fallback template.
2. Update Tailwind `content` globs and add lint rules to forbid raw hex values outside `styles/tokens.css` and `design-tokens.ts`.
3. Expand Storybook/Docs coverage to include the new interaction utilities and surfaces so component authors see the sanctioned variants before Phase 2 component refactors.
