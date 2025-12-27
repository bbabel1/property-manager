-- Backfill missing account_entity_type values and add constraints
-- Sets 'Rental' for property/unit/lease-linked lines, 'Company' for unlinked lines
-- Adds default and CHECK constraint to prevent NULL values

begin;

-- 1) Backfill missing account_entity_type values
-- Strategy:
--   - Lines linked to property/unit/lease: 'Rental'
--   - Lines with no property/unit/lease linkage: 'Company'
update public.transaction_lines
set account_entity_type = case
    when property_id is not null
      or unit_id is not null
      or lease_id is not null
      or buildium_lease_id is not null
      or buildium_property_id is not null
    then 'Rental'::public.entity_type_enum
    else 'Company'::public.entity_type_enum
  end
where account_entity_type is null;

-- 2) Add default value to prevent future NULLs
alter table public.transaction_lines
  alter column account_entity_type set default 'Rental'::public.entity_type_enum;

-- 3) Add CHECK constraint to ensure account_entity_type is never NULL
-- Note: The column is already NOT NULL in the schema, but this provides an extra safeguard
alter table public.transaction_lines
  add constraint transaction_lines_account_entity_type_not_null
  check (account_entity_type is not null);

comment on constraint transaction_lines_account_entity_type_not_null on public.transaction_lines is
'Ensures account_entity_type is always set. Rental for property/unit/lease-linked transactions, Company for unlinked transactions.';

commit;

