-- Remove redundant vacant_units_count field from properties table
-- This field is redundant with total_vacant_units

-- Drop the index first
DROP INDEX IF EXISTS idx_properties_vacant_units_count;

-- Drop the check constraint
ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS check_vacant_units_count_non_negative;
ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS check_vacant_units_count_not_exceed_total;

-- Drop the column
ALTER TABLE public.properties DROP COLUMN IF EXISTS vacant_units_count;

-- Update the function to remove references to vacant_units_count
CREATE OR REPLACE FUNCTION public.update_property_unit_counts(property_uuid uuid)
RETURNS void
LANGUAGE plpgsql
AS $function$
BEGIN
  UPDATE public.properties
  SET 
    total_units = (
      SELECT COUNT(*)
      FROM public.units
      WHERE property_id = property_uuid
    ),
    total_active_units = (
      SELECT COUNT(*)
      FROM public.units
      WHERE property_id = property_uuid
      AND status != 'Inactive'
    ),
    total_occupied_units = (
      SELECT COUNT(*)
      FROM public.units
      WHERE property_id = property_uuid
      AND status = 'Occupied'
    ),
    total_vacant_units = (
      SELECT COUNT(*)
      FROM public.units
      WHERE property_id = property_uuid
      AND status = 'Vacant'
    ),
    total_inactive_units = (
      SELECT COUNT(*)
      FROM public.units
      WHERE property_id = property_uuid
      AND status = 'Inactive'
    )
  WHERE id = property_uuid;
END$function$;

COMMENT ON FUNCTION public.update_property_unit_counts(uuid) IS 'Updates all unit count fields (total, active, occupied, vacant, inactive) for a property - removed redundant vacant_units_count';
