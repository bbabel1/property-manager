-- Backfill missing account_entity_type values based on property_id/unit_id/lease_id presence
-- This ensures all transaction lines have a valid entity type for proper balance calculations

begin;

-- Set account_entity_type to 'Rental' for lines linked to properties/units/leases
UPDATE public.transaction_lines
SET account_entity_type = 'Rental'::public.entity_type_enum
WHERE account_entity_type IS NULL
  AND (
    property_id IS NOT NULL 
    OR unit_id IS NOT NULL 
    OR lease_id IS NOT NULL
    OR buildium_property_id IS NOT NULL
    OR buildium_unit_id IS NOT NULL
    OR buildium_lease_id IS NOT NULL
  );

-- Set account_entity_type to 'Company' for lines not linked to properties/units/leases
UPDATE public.transaction_lines
SET account_entity_type = 'Company'::public.entity_type_enum
WHERE account_entity_type IS NULL
  AND property_id IS NULL
  AND unit_id IS NULL
  AND lease_id IS NULL
  AND buildium_property_id IS NULL
  AND buildium_unit_id IS NULL
  AND buildium_lease_id IS NULL;

-- Add constraint to ensure account_entity_type is never null going forward
ALTER TABLE public.transaction_lines
  ALTER COLUMN account_entity_type SET DEFAULT 'Rental'::public.entity_type_enum;

-- Add check constraint to prevent NULL values (after backfill)
ALTER TABLE public.transaction_lines
  ADD CONSTRAINT transaction_lines_account_entity_type_not_null 
  CHECK (account_entity_type IS NOT NULL);

comment on constraint transaction_lines_account_entity_type_not_null on public.transaction_lines is
'Ensures account_entity_type is always set to enable proper entity-type filtering in balance calculations';

commit;
