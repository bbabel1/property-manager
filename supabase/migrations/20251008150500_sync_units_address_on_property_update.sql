-- Keep unit address in sync with its property's address
-- When a property's address changes, update all related units' address fields

CREATE OR REPLACE FUNCTION public.fn_sync_units_address_on_property_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only act when relevant address fields actually changed
  IF TG_OP = 'UPDATE' AND (
    NEW.address_line1 IS DISTINCT FROM OLD.address_line1 OR
    NEW.address_line2 IS DISTINCT FROM OLD.address_line2 OR
    NEW.address_line3 IS DISTINCT FROM OLD.address_line3 OR
    NEW.city IS DISTINCT FROM OLD.city OR
    NEW.state IS DISTINCT FROM OLD.state OR
    NEW.postal_code IS DISTINCT FROM OLD.postal_code OR
    NEW.country IS DISTINCT FROM OLD.country
  ) THEN
    UPDATE public.units u
    SET
      address_line1 = NEW.address_line1,
      address_line2 = NEW.address_line2,
      address_line3 = NEW.address_line3,
      city          = NEW.city,
      state         = NEW.state,
      postal_code   = NEW.postal_code,
      country       = NEW.country,
      updated_at    = NOW()
    WHERE u.property_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Replace existing trigger if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'tr_sync_units_address_on_property_update'
  ) THEN
    DROP TRIGGER tr_sync_units_address_on_property_update ON public.properties;
  END IF;
END $$;

CREATE TRIGGER tr_sync_units_address_on_property_update
AFTER UPDATE OF address_line1, address_line2, address_line3, city, state, postal_code, country
ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_units_address_on_property_update();

