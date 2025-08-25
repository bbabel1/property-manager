-- Remove redundant columns from owners table that duplicate contacts table fields
-- Migration: 20250821051705_remove_redundant_owners_columns.sql

-- Remove identity fields (these belong in contacts)
alter table public.owners drop column if exists first_name;
alter table public.owners drop column if exists last_name;
alter table public.owners drop column if exists company_name;
alter table public.owners drop column if exists is_company;
alter table public.owners drop column if exists date_of_birth;

-- Remove contact information (these belong in contacts)
alter table public.owners drop column if exists primary_email;
alter table public.owners drop column if exists alt_email;
alter table public.owners drop column if exists primary_phone;
alter table public.owners drop column if exists alt_phone;

-- Remove address fields (these belong in contacts)
alter table public.owners drop column if exists primary_address_line_1;
alter table public.owners drop column if exists primary_address_line_2;
alter table public.owners drop column if exists primary_address_line_3;
alter table public.owners drop column if exists primary_city;
alter table public.owners drop column if exists primary_state;
alter table public.owners drop column if exists primary_postal_code;
alter table public.owners drop column if exists primary_country;

alter table public.owners drop column if exists alt_address_line_1;
alter table public.owners drop column if exists alt_address_line_2;
alter table public.owners drop column if exists alt_address_line_3;
alter table public.owners drop column if exists alt_city;
alter table public.owners drop column if exists alt_state;
alter table public.owners drop column if exists alt_postal_code;
alter table public.owners drop column if exists alt_country;

-- Remove mailing preference (belongs in contacts)
alter table public.owners drop column if exists mailing_preference;

-- Remove tax fields (these belong in contacts)
alter table public.owners drop column if exists tax_payer_id;
alter table public.owners drop column if exists tax_payer_type;
alter table public.owners drop column if exists tax_payer_name;
alter table public.owners drop column if exists tax_address_line_1;
alter table public.owners drop column if exists tax_address_line_2;
alter table public.owners drop column if exists tax_address_line_3;
alter table public.owners drop column if exists tax_city;
alter table public.owners drop column if exists tax_state;
alter table public.owners drop column if exists tax_postal_code;
alter table public.owners drop column if exists tax_country;

-- Clean up the analysis views since we've removed the redundant columns
drop view if exists public._owners_contacts_overlap;
drop view if exists public._owners_specific_columns;
drop view if exists public._owners_column_analysis;

-- Drop the other diagnostic views as requested earlier
drop view if exists public._owners_unexpected_columns;
drop view if exists public._ownerships_unexpected_columns;

-- Refresh the cache tables to reflect the new structure
-- The cache tables will continue to work since they pull data from contacts table
do $$
begin
  -- Refresh owners list cache
  delete from public.owners_list_cache;
  insert into public.owners_list_cache (owner_id, contact_id, display_name, primary_email, primary_phone,
                                        management_agreement_start_date, management_agreement_end_date)
  select
    o.id, c.id,
    coalesce(nullif(trim(c.first_name||' '||c.last_name),''), c.company_name),
    c.primary_email, c.primary_phone,
    o.management_agreement_start_date, o.management_agreement_end_date
  from public.owners o
  join public.contacts c on c.id = o.contact_id;

  -- Refresh property ownerships cache
  delete from public.property_ownerships_cache;
  insert into public.property_ownerships_cache (
    ownership_id, property_id, owner_id, contact_id, display_name, primary_email,
    "primary", ownership_percentage, disbursement_percentage
  )
  select
    ow.id, ow.property_id, ow.owner_id, c.id,
    coalesce(nullif(trim(c.first_name||' '||c.last_name),''), c.company_name),
    c.primary_email,
    ow."primary", ow.ownership_percentage, ow.disbursement_percentage
  from public.ownerships ow
  join public.owners o   on o.id = ow.owner_id
  join public.contacts c on c.id = o.contact_id;
end$$;
