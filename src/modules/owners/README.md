# Owners Module

Responsibilities:

- Owner data access and relationships (primarily via property services today).
- Owner-facing validation and helpers.

Key entrypoints:

- Services: `./services` (delegates to `@/lib/property-service` until specialized owner services are added).

Conventions:

- Keep owner-specific logic here as it grows; avoid sprinkling owner lookups across components.
