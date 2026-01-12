# API org/auth foundation

Use the user-scoped client and org guards on API routes so we never bypass RLS unintentionally.

## Standard flow (per request)
- Authenticate: `const { supabase, user } = await requireAuth();`
- Resolve org: `const orgId = await resolveOrgIdFromRequest(request, user.id, supabase);`
- Enforce membership: `await requireOrgMember({ client: supabase, userId: user.id, orgId });`
- Use that `supabase` client for all reads/writes. Only reach for `supabaseAdmin` when an operation truly requires bypassing RLS (e.g., cross-org background sync), and document why.
- For resource-scoped endpoints, prefer `resolveResourceOrg` helpers to derive org ownership from the resource id before membership checks.

## RLS coverage (safe to rely on user client)
- `owners`, `ownerships`, `properties`, `units`: org-scoped read/write/update policies via `create_org_policies_if_table_exists` (see `supabase/migrations/20260310120000_rbac_phase7_policy_refresh.sql`).
- `vendors`: org-scoped read/write/update policies replacing permissive defaults (see `supabase/migrations/20250917020000_089_fix_permissive_policies_and_duplicate_indexes.sql`).
- All four tables have RLS enabled in `supabase/migrations/20240101000001_001_initial_schema.sql`; subsequent migrations refresh policies to enforce `auth.uid()` membership.

## Do/Don’t
- Do pass the user client into `resolveOrgIdFromRequest` so membership verification happens during org resolution.
- Do keep org_id set/validated on inserts (derive from parent resources where applicable).
- Don’t default to `supabaseAdmin || supabase`; avoid admin unless explicitly required and guard with org membership when possible.
