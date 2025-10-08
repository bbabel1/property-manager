-- Copies property address to units by default on insert (and on property_id change)
-- Fields: address_line1/2/3, city, state, postal_code, country

CREATE OR REPLACE FUNCTION public.fn_units_copy_address_from_property()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  p_address1 text;
  p_address2 text;
  p_address3 text;
  p_city text;
  p_state text;
  p_postal text;
  p_country public.countries;
BEGIN
  IF NEW.property_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT address_line1, address_line2, address_line3, city, state, postal_code, country
  INTO p_address1, p_address2, p_address3, p_city, p_state, p_postal, p_country
  FROM public.properties
  WHERE id = NEW.property_id;

  -- If any address field is not provided for the unit, copy from the property
  IF NEW.address_line1 IS NULL OR NEW.address_line1 = '' THEN NEW.address_line1 := p_address1; END IF;
  IF NEW.address_line2 IS NULL OR NEW.address_line2 = '' THEN NEW.address_line2 := p_address2; END IF;
  IF NEW.address_line3 IS NULL OR NEW.address_line3 = '' THEN NEW.address_line3 := p_address3; END IF;
  IF NEW.city IS NULL OR NEW.city = '' THEN NEW.city := p_city; END IF;
  IF NEW.state IS NULL OR NEW.state = '' THEN NEW.state := p_state; END IF;
  IF NEW.postal_code IS NULL OR NEW.postal_code = '' THEN NEW.postal_code := p_postal; END IF;
  IF NEW.country IS NULL THEN NEW.country := p_country; END IF;

  RETURN NEW;
END;
$$;

-- Idempotently (re)create triggers
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_units_copy_address_on_insert') THEN
    DROP TRIGGER tr_units_copy_address_on_insert ON public.units;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_units_copy_address_on_property_change') THEN
    DROP TRIGGER tr_units_copy_address_on_property_change ON public.units;
  END IF;
END $$;

-- Copy address before insert (allows overriding by explicitly passing values)
CREATE TRIGGER tr_units_copy_address_on_insert
BEFORE INSERT ON public.units
FOR EACH ROW
EXECUTE FUNCTION public.fn_units_copy_address_from_property();

-- Also recopy addresses if the unit is reassigned to a different property
CREATE TRIGGER tr_units_copy_address_on_property_change
BEFORE UPDATE OF property_id ON public.units
FOR EACH ROW
EXECUTE FUNCTION public.fn_units_copy_address_from_property();

