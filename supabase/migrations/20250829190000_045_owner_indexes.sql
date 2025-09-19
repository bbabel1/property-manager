-- Owner/Contact performance indexes
create index if not exists idx_owners_buildium_owner_id on public.owners (buildium_owner_id);
create index if not exists idx_owners_contact_id on public.owners (contact_id);

create index if not exists idx_contacts_primary_email on public.contacts (primary_email);
create index if not exists idx_contacts_name on public.contacts (last_name, first_name);

-- Ownership lookups
create index if not exists idx_ownerships_owner_id on public.ownerships (owner_id);
create index if not exists idx_ownerships_property_id on public.ownerships (property_id);

-- Properties linkage
create index if not exists idx_properties_buildium_property_id on public.properties (buildium_property_id);

