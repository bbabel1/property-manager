# Properties Module

Responsibilities:

- Property CRUD, summaries, owner/unit relationships.
- Shared property UI exports for app routes.
- Bridges to owner/unit services where needed.

Key entrypoints:

- Services: `./services` (exports from `@/lib/property-service`).
- Components: `./components` (property UI facade).

Conventions:

- Keep Supabase queries in services; UI should consume services or API routes, not Supabase directly.
- Reuse shared schemas/validation when adding new endpoints.
