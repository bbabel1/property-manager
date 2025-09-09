-- Add location fields to properties (borough, neighborhood, longitude, latitude, location_verified)

BEGIN;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS borough VARCHAR(100),
  ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(100),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS location_verified BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.properties.borough IS 'Borough or district where the property is located';
COMMENT ON COLUMN public.properties.neighborhood IS 'Neighborhood or area within the borough';
COMMENT ON COLUMN public.properties.longitude IS 'Longitude coordinate for property location';
COMMENT ON COLUMN public.properties.latitude IS 'Latitude coordinate for property location';
COMMENT ON COLUMN public.properties.location_verified IS 'Whether the location coordinates have been verified';

CREATE INDEX IF NOT EXISTS idx_properties_borough ON public.properties(borough);
CREATE INDEX IF NOT EXISTS idx_properties_neighborhood ON public.properties(neighborhood);
CREATE INDEX IF NOT EXISTS idx_properties_location ON public.properties(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

COMMIT;

