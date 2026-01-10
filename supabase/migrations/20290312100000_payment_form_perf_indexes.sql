-- Quick-win indexes to speed payment form lookups.
-- These are idempotent and safe to run in any environment.

create index if not exists idx_gl_accounts_org_id on public.gl_accounts (org_id);
create index if not exists idx_lease_contacts_lease_id on public.lease_contacts (lease_id);
-- units.id is already indexed by the primary key; no additional index required.
-- Note: lease_tenants table does not exist; the relationship is handled via lease_contacts.
