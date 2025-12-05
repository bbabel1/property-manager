-- Add Buildium org id mapping to organizations
alter table public.organizations
  add column if not exists buildium_org_id bigint;

create unique index if not exists organizations_buildium_org_id_key
  on public.organizations(buildium_org_id)
  where buildium_org_id is not null;
