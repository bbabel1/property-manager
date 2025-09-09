-- Function to update all unit count fields for a property
CREATE OR REPLACE FUNCTION public.update_property_unit_counts(property_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
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

-- Create trigger to automatically update unit counts when units are modified
CREATE OR REPLACE FUNCTION public.trigger_update_property_unit_counts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
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

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_units_total_units_insert ON public.units;
DROP TRIGGER IF EXISTS trigger_units_total_units_update ON public.units;
DROP TRIGGER IF EXISTS trigger_units_total_units_delete ON public.units;

-- Create new comprehensive trigger
CREATE TRIGGER trigger_units_comprehensive_counts
  AFTER INSERT OR UPDATE OR DELETE ON public.units
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_update_property_unit_counts();
