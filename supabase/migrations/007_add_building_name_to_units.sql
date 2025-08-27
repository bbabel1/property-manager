-- Add building_name field to units table
-- This field will store the building name for units in multi-building properties

ALTER TABLE public.units 
ADD COLUMN building_name text;

COMMENT ON COLUMN public.units.building_name IS 'Building name for units in multi-building properties';
