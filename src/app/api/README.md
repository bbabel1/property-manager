API Route Organization and Conventions

Overview

- App router location: routes live under `src/app/api/...`.
- Group by domain first (properties, units, owners, bank-accounts), and by external system second (buildium/*).
- Keep server-only logic in routes; share cross-cutting helpers from `src/lib`.

Structure

- `src/app/api/<domain>`: First-party resources (e.g., `/api/properties`, `/api/units`).
- `src/app/api/<domain>/<id>`: Resource-specific actions.
- `src/app/api/<domain>/<id>/<subresource>`: Narrow actions (e.g., `/api/properties/{id}/details`).
- `src/app/api/buildium/*`: All Buildium proxy/sync endpoints, mirroring Buildium URL structure.

Shared Utilities

- Buildium HTTP: use `buildiumFetch` from `src/lib/buildium-http.ts` to standardize headers, base URL, and logging.
- Auth: use `requireUser(request)` for authenticated routes.
- Rate limiting: use `checkRateLimit(request)` where appropriate for Buildium proxies.
- Validation: use Zod schemas + `sanitizeAndValidate` for all request bodies.
- Logging: prefer `logger` with structured context on actions and errors.

Response Shape

- Success: `{ success: true, data, ...optional }` with 2xx codes.
- Errors: `{ error: string, details?: any }` with appropriate 4xx/5xx.

Do’s

- Prefer `buildiumFetch` over ad-hoc `fetch` when calling Buildium.
- Keep route handlers small; push mapping/transform logic to `src/lib`.
- Use descriptive subpaths under domain routes (`/details`, `/banking`, etc.).

Don’ts

- Don’t duplicate Buildium headers or base URL handling inside routes.
- Don’t mix unrelated concerns in a single route handler.

