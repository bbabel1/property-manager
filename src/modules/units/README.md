# Units Module

Responsibilities:
- Unit data access, status, and property relationship helpers.

Key entrypoints:
- Services: `./services` (exports from `@/lib/unit-service`).

Conventions:
- Keep unit queries in services; API routes and UI should call into this module rather than raw Supabase calls.
