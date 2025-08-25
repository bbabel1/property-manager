-- Migration: Auto-populate buildium_property_id in units from properties table

-- Assumes units table has a property_id column referencing properties(id)
-- and properties table has buildium_property_id column

CREATE OR REPLACE FUNCTION set_buildium_property_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.property_id IS NOT NULL THEN
    SELECT buildium_property_id INTO NEW.buildium_property_id
    FROM properties WHERE id = NEW.property_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_buildium_property_id ON units;
CREATE TRIGGER trg_set_buildium_property_id
BEFORE INSERT OR UPDATE ON units
FOR EACH ROW
EXECUTE FUNCTION set_buildium_property_id();
