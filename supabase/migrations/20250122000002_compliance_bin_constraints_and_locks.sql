-- Compliance BIN constraints and advisory lock helpers

-- Enforce BIN format (7 numeric digits) when present
ALTER TABLE public.properties
  ADD CONSTRAINT properties_bin_format_chk
  CHECK (bin IS NULL OR bin ~ '^[0-9]{7}$');

-- Require BIN for NYC boroughs (NOT VALID allows existing rows to violate constraint)
ALTER TABLE public.properties
  ADD CONSTRAINT properties_bin_required_for_nyc_chk
  CHECK (
    borough NOT IN ('Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island')
    OR bin IS NOT NULL
  ) NOT VALID;

-- Belt-and-suspenders: require BIN when city is New York (NOT VALID allows existing rows to violate constraint)
ALTER TABLE public.properties
  ADD CONSTRAINT properties_bin_required_for_nyc_city_chk
  CHECK (
    lower(city) <> 'new york'
    OR bin IS NOT NULL
  ) NOT VALID;

-- Ensure BIN lookups remain fast
CREATE INDEX IF NOT EXISTS idx_properties_bin ON public.properties (bin);

-- Lightweight advisory lock helpers for compliance sync
CREATE OR REPLACE FUNCTION public.acquire_compliance_lock(lock_key text)
RETURNS boolean
LANGUAGE sql
AS $$
  SELECT pg_try_advisory_lock(hashtext(lock_key));
$$;
COMMENT ON FUNCTION public.acquire_compliance_lock IS 'Attempts to take an advisory lock for the provided key; returns true when acquired';

CREATE OR REPLACE FUNCTION public.release_compliance_lock(lock_key text)
RETURNS boolean
LANGUAGE sql
AS $$
  SELECT pg_advisory_unlock(hashtext(lock_key));
$$;
COMMENT ON FUNCTION public.release_compliance_lock IS 'Releases an advisory lock for the provided key; returns true when unlocked';
