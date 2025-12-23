# Leases Module

Responsibilities:

- Lease transaction helpers, calculations, and Supabase access.

Key entrypoints:

- Services: `./services` (exports helpers from `@/lib/lease-transaction-service` and `@/lib/lease-transaction-helpers`).

Conventions:

- Centralize lease math and queries here; keep API handlers thin.
