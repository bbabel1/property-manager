# Feature Map

This guide links major features to their primary routes and modules.

- **Properties**: Routes under `src/app/(protected)/properties/*`; services in `src/modules/properties/services`; UI in `src/components/property`.
- **Owners**: Managed alongside properties; service exports in `src/modules/owners/services`.
- **Units**: Routes under `src/app/(protected)/properties/[id]/units`; services in `src/modules/units/services`.
- **Leases**: Helpers in `src/modules/leases/services`; API/routes under `src/app/api/leases*` (where present).
- **Banking**: Bank account helpers in `src/modules/banking/services`; Buildium sync scripts in `scripts/buildium/*`.
- **Monthly Logs**: UI in `src/components/monthly-logs/*`; services/schemas in `src/modules/monthly-logs/*`; docs in `docs/MONTHLY_LOG_README.md`.
- **Auth**: Supabase-based; middleware/providers in `src/lib/auth`, `src/lib/supabase`.
- **Buildium Integration**: Scripts under `scripts/buildium/*`; docs in `docs/buildium-*`.
