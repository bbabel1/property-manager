# Staff Module

Responsibilities:

- Staff role normalization and validation.

Key entrypoints:

- Services: `./services` (exports from `@/lib/staff-role`).

Conventions:

- Keep role parsing/validation here; reuse across API routes and services to avoid duplicated enums.
