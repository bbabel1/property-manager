# Modal sizing and elevation variants

- **Default size (`md`)**: `DialogContent` without an explicit `size` prop uses `md`, which renders at `w-full max-w-[680px]` with a rounded-2xl border and `shadow-xl`.
- **Large size (`lg`)**: Use `size="lg"` or `LargeDialogContent` for wider modals (`w-full max-w-[800px]`).
- **Elevation/radius**: All standard dialogs share the same `rounded-2xl`, `border border-border/80`, and `shadow-xl` elevation tokens via `DialogContent`.

