# Monthly Logs API Reference

<!-- markdownlint-configure-file {"MD013": false} -->

This note points to the primary Monthly Logs HTTP handlers and where to find their implementations.

- Entrypoints live under `src/app/api/monthly-logs/` (and nested subroutes for statements, transactions, and reports).
- Core actions: create/update monthly logs, assign/unassign transactions, generate/preview PDFs, send statements, reconcile, manage recurring tasks, and fetch related entities.
- Review handlers such as `src/app/api/monthly-logs/[logId]/route.ts`, `.../transactions/`, `.../generate-pdf/`, `.../send-statement/`, `.../management-fees/`, and `.../stage-transactions/` for the latest contract details.
- For broader API conventions and auth/response patterns, see `docs/api/api-documentation.md`.

Run `npm run lint` and `npm run typecheck` before shipping API changes to catch contract drift early.
