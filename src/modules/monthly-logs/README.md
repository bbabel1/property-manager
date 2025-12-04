# Monthly Logs Module

Responsibilities:
- Monthly log workflow services (fetch/update recipients, stage handling, calculations).
- Zod schemas for monthly-log payloads.
- Domain-specific UI exports for monthly logs.

Key entrypoints:
- Services: `./services` (e.g., statement recipient helpers).
- Schemas: `./schemas`.
- UI: `./components` (re-export of monthly log components).

Conventions:
- Keep Supabase access inside services.
- Validate inputs/outputs with Zod before hitting API routes.
