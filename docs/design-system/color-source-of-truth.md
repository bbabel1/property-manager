# Color Source of Truth

The canonical pipeline for all colors in this repo:

1. **Tokens** — `styles/tokens.css` defines the primitive and semantic CSS variables (`--color-*`, `--background`, `--primary`, `--surface-*`, `--state-*`). This is the only place to introduce or adjust color values.
2. **Theme bridge** — `tailwind.config.ts` maps those variables into Tailwind’s theme (e.g., `bg-primary`, `text-muted-foreground`, `border-border-subtle`, `bg-surface-primary-soft`). When you add a new token, expose it here so utilities and component variants can consume it.
3. **Consumption** — Components must use semantic Tailwind utilities or shared primitives (buttons, badges, typography). Do not reach for `var(--color-*)` strings or reintroduce `palette-*` helpers.

Additional contexts:

- **Server-rendered email/PDF**: `src/lib/design-tokens.ts` mirrors the same palette for non-DOM environments. Keep it in sync with `styles/tokens.css` when adding colors.
- **Charts**: Prefer the chart config pattern in `src/components/ui/chart.tsx` where series colors come from component config, not ad-hoc CSS variables.

### Workflow for a new/updated color

1. Add/update the token in `styles/tokens.css` with contrast notes in the PR.
2. Map it in `tailwind.config.ts` under the appropriate semantic key.
3. Use the Tailwind utility (or add a typed variant to a component) instead of inline CSS vars.
4. Sync non-DOM mirrors in `src/lib/design-tokens.ts` if needed.

### Guardrails

- Raw `var(--color-*)` usage in components is discouraged; escalate missing tokens instead of bypassing the pipeline.
- Legacy palette helpers (`text-palette-*`, `bg-palette-*`) are removed and blocked by lint.
- If you find a color need that isn’t covered, add the token first—do not hand-roll hex/hsl values in JSX.
