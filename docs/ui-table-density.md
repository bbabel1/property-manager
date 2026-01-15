# Table density guidelines

- **Default density**: `comfortable` (Table without an explicit `density` prop).
- **Compact variant**: use `density="compact"` on `Table`/`TableRow`/`TableCell` for tighter tables.
- **Comfortable variant**: use `density="comfortable"` for primary data views.
- **Hover state**: row hover uses tokenized `bg-muted` (`bg-muted/40` for compact, `bg-muted/50` for comfortable) via the shared `TableRow` component.

