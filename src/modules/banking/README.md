# Banking Module

Responsibilities:
- Bank account services and GL alignment helpers.
- Integration points for Buildium syncing when relevant.

Key entrypoints:
- Services: `./services` (exports from `@/lib/bank-account-service`).

Conventions:
- Keep financial account queries and calculations in services; UI/API routes should avoid direct Supabase calls.
