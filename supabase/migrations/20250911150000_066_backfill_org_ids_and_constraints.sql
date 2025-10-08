-- Idempotent backfill of org_id based on existing FKs, then add strictness
-- Adapted to current schema: properties, units, ownerships, owners (via primary ownership),
-- work_orders (via property/unit), lease_contacts (via tenants)
-- Add missing org_id columns to properties and units tables (should have been in 20250911141000_064_extend_rls_and_portals.sql)
alter table public.properties
add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists idx_properties_org on public.properties(org_id);
alter table public.units
add column if not exists org_id uuid references public.organizations(id) on delete restrict;
create index if not exists idx_units_org on public.units(org_id);
-- Create a default organization if none exists (for fresh database)
do $$
declare default_org_id uuid;
begin -- Check if any organizations exist
if not exists (
  select 1
  from public.organizations
  limit 1
) then -- Create default organization
insert into public.organizations (name, slug)
values ('Default Organization', 'default')
returning id into default_org_id;
-- Assign all properties to default org
update public.properties
set org_id = default_org_id
where org_id is null;
end if;
end $$;
-- Units <- Properties (now that properties have org_id)
update public.units u
set org_id = p.org_id
from public.properties p
where u.property_id = p.id
  and u.org_id is null
  and p.org_id is not null;
-- Ownerships <- Properties
update public.ownerships ow
set org_id = p.org_id
from public.properties p
where ow.property_id = p.id
  and ow.org_id is null
  and p.org_id is not null;
-- Owners <- Ownerships (prefer primary ownership when present)
update public.owners o
set org_id = p.org_id
from public.ownerships ow
  join public.properties p on p.id = ow.property_id
where ow.owner_id = o.id
  and ow.primary = true
  and o.org_id is null
  and p.org_id is not null;
update public.work_orders w
set org_id = coalesce(
    p.org_id,
    (
      select u.org_id
      from public.units u
      where u.id = w.unit_id
    )
  )
from public.properties p
where w.property_id = p.id
  and w.org_id is null
  and (
    p.org_id is not null
    or exists (
      select 1
      from public.units u2
      where u2.id = w.unit_id
        and u2.org_id is not null
    )
  );
-- Lease contacts <- Tenants
update public.lease_contacts lc
set org_id = t.org_id
from public.tenants t
where lc.tenant_id = t.id
  and lc.org_id is null
  and t.org_id is not null;
-- Constraints: flip NOT NULL where safely backfilled
alter table public.properties
alter column org_id
set not null;
alter table public.units
alter column org_id
set not null;
alter table public.ownerships
alter column org_id
set not null;
-- Scoped uniqueness example: property name unique per org
create unique index if not exists uq_properties_org_name on public.properties(org_id, name);