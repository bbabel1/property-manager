-- Fix property unit counts to properly track occupied, vacant, and inactive units
-- This migration creates a comprehensive function to update all unit count fields

-- Create comprehensive function to update all unit count fields
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
    ),
    vacant_units_count = (
      SELECT COUNT(*)
      FROM public.units
      WHERE property_id = property_uuid
      AND status = 'Vacant'
    )
  WHERE id = property_uuid;
END$function$;

-- Create trigger function to automatically update unit counts
CREATE OR REPLACE FUNCTION public.trigger_update_property_unit_counts()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  -- Handle INSERT
  IF TG_OP = 'INSERT' THEN
    PERFORM public.update_property_unit_counts(NEW.property_id);
    RETURN NEW;
  END IF;
  
  -- Handle UPDATE
  IF TG_OP = 'UPDATE' THEN
    -- Update counts for both old and new property_id (in case property changed)
    IF OLD.property_id != NEW.property_id THEN
      PERFORM public.update_property_unit_counts(OLD.property_id);
      PERFORM public.update_property_unit_counts(NEW.property_id);
    ELSE
      PERFORM public.update_property_unit_counts(NEW.property_id);
    END IF;
    RETURN NEW;
  END IF;
  
  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    PERFORM public.update_property_unit_counts(OLD.property_id);
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END$function$;

-- Drop existing triggers that only update total_units
DROP TRIGGER IF EXISTS trigger_units_total_units_insert ON public.units;
DROP TRIGGER IF EXISTS trigger_units_total_units_update ON public.units;
DROP TRIGGER IF EXISTS trigger_units_total_units_delete ON public.units;

-- Create new comprehensive trigger
CREATE TRIGGER trigger_units_comprehensive_counts
  AFTER INSERT OR UPDATE OR DELETE ON public.units
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_update_property_unit_counts();

-- Update all existing properties with correct unit counts
DO $$
DECLARE
  property_record RECORD;
BEGIN
  FOR property_record IN 
    SELECT id FROM public.properties
  LOOP
    PERFORM public.update_property_unit_counts(property_record.id);
  END LOOP;
END $$;

COMMENT ON FUNCTION public.update_property_unit_counts(uuid) IS 'Updates all unit count fields (total, active, occupied, vacant, inactive) for a property';
COMMENT ON FUNCTION public.trigger_update_property_unit_counts() IS 'Trigger function to automatically update property unit counts when units are modified';
