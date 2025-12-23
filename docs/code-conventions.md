# Code Conventions

## Naming

- **Domain folders**: Prefer pluralized names (for example, `monthly-logs`, `properties`, `transactions`) to match collection-oriented APIs and keep barrels predictable.
- **React components**: Use `PascalCase` component names and align file names with the component (e.g., `TenantNotesTable.tsx` should export `TenantNotesTable`).
- **Hooks**: Prefix hooks with `use` and keep them in `camelCase` (for example, `useManagersOptions`). Hooks that are colocated in a folder should also be exported through the local `index.ts` barrel.

## Barrels

- Each domain folder should expose an `index.ts` that re-exports its public API so imports can use the folder path instead of deep relative paths.
- Prefer importing from the domain barrel (e.g., `@/components/monthly-logs`) instead of individual files when possible.
