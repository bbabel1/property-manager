# Buildium Console Theme Reference

Our UI now mirrors the managedbyorasandbox Buildium console theme, keeping palette and typography consistent with the production dashboard and properties views.[1](https://managedbyorasandbox.managebuilding.com/manager/app/homepage/dashboard)[2](https://managedbyorasandbox.managebuilding.com/manager/app/properties)

## Color Palette

| Token                | Hex       | Usage                                               |
| -------------------- | --------- | --------------------------------------------------- |
| `--color-brand-500`  | `#1F3D56` | Primary slate: nav background, headings, table text |
| `--color-brand-700`  | `#132A38` | Sidebar hover/pressed states                        |
| `--color-action-400` | `#5386E5` | Primary CTAs such as “Add property”                 |
| `--color-action-500` | `#346CCD` | CTA hover/active                                    |
| `--color-gray-50`    | `#F5F7FA` | Workspace background                                |
| `--color-gray-100`   | `#EEF1F4` | Muted panels, table header fill                     |
| `--color-gray-200`   | `#E1E6EB` | Card borders, dividers                              |
| `--color-gray-600`   | `#738495` | Secondary text                                      |
| `--color-danger-500` | `#D94841` | Alerts/badges                                       |

The remaining semantic tokens (muted, secondary, accent, etc.) proxy to these primitives inside `styles/tokens.css`. Sidebar tokens use `--color-brand-500`/`--color-brand-700` for depth, while action surfaces point at the Ora blue scale. Focus rings reuse the CTA Ora blue so keyboard states stay consistent.

## Typography

- **Primary font**: `Source Sans 3` (weights 400/500/600/700 loaded via `next/font`)
- **Fallbacks**: `Source Sans Pro`, `Open Sans`, system UI stack
- **Scale**: 1rem base with medium headings (`font-weight: 600`), matching dashboard card titles and table typography.[1](https://managedbyorasandbox.managebuilding.com/manager/app/homepage/dashboard)

## Implementation Notes

- Tokens live in `styles/tokens.css` and feed Tailwind aliases through `@theme inline` in `src/app/globals.css`.
- Sidebar, cards, tables, and buttons consume `bg-sidebar`, `bg-card`, `bg-muted`, `text-secondary`, and `bg-primary` classes, so the new palette flows across the app without component rewrites.
- Keep imports of `styles/tokens.css` at the top of `globals.css` to ensure tokens are available before Tailwind layers.
- When introducing new status or badge colors, extend the existing action green or slate scales first to maintain contrast.

## Property Summary Surfaces

- Reuse the shared `.surface-card` utility for property summary panels; it applies the tokenized radius (`--radius-xl`) and border (`--border`) without extra drop shadows.
- Use `.surface-card--muted` when the card needs the soft brand surface/background highlight (e.g., banking rail) while retaining the flat border treatment.
- Apply `.eyebrow-label` to all eyebrow/section labels to keep typography at `--text-xs`, uppercase tracking, and AA-compliant contrast (`--text-muted`).
- Replace ad-hoc separators with `.card-divider` or `.divide-card` to align divider color with `--border-subtle`.
- Prefer token-backed utility classes (`text-muted-foreground`, `text-primary`, `border`) over arbitrary Tailwind color/shadow hacks to avoid contrast regressions.
