-- Normalize country text values and convert columns to public.countries enum
-- Safe, staged approach:
--  1) Define normalization function (idempotent)
--  2) Normalize values in-place for key tables/columns
--  3) If no invalid values remain, VALIDATE constraints and convert column types to enum
--  4) Drop NOT VALID check constraints post-conversion (enum enforces correctness)

-- 1) Normalization function
CREATE OR REPLACE FUNCTION public.normalize_country(val text)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v text;
BEGIN
  IF val IS NULL THEN RETURN NULL; END IF;
  v := trim(val);
  IF v = '' THEN RETURN NULL; END IF;
  -- lowercase, strip punctuation, collapse whitespace
  v := lower(v);
  v := regexp_replace(v, '[\.]', '', 'g');         -- remove dots
  v := regexp_replace(v, '[_-]', ' ', 'g');         -- underscores/hyphens to space
  v := regexp_replace(v, '\s+', ' ', 'g');         -- collapse spaces
  v := trim(v);

  -- canonical mappings
  IF v IN ('us','u s','usa','u s a','united states','united states of america','unitedstates') THEN
    RETURN 'United States';
  ELSIF v IN ('uk','u k','united kingdom','great britain') THEN
    RETURN 'United Kingdom';
  ELSIF v IN ('uae','u a e','united arab emirates') THEN
    RETURN 'United Arab Emirates';
  ELSIF v IN ('czech republic','czechia') THEN
    RETURN 'Czech Republic (Czechia)';
  ELSIF v IN ('ivory coast','cote divoire','cote d ivoire') THEN
    RETURN 'Ivory Coast (Côte d''Ivoire)';
  ELSIF v = 'north korea' THEN
    RETURN 'Korea (North Korea)';
  ELSIF v = 'south korea' THEN
    RETURN 'Korea (South Korea)';
  ELSIF v = 'macedonia' THEN
    RETURN 'North Macedonia';
  ELSIF v = 'burma' THEN
    RETURN 'Myanmar (Burma)';
  ELSIF v IN ('sao tome and principe','sao tome & principe') THEN
    RETURN 'São Tomé and Príncipe';
  ELSIF v = 'vatican city' THEN
    RETURN 'Vatican City (Holy See)';
  ELSIF v IN ('saint kitts and nevis','st kitts and nevis','st. kitts and nevis') THEN
    RETURN 'Saint Kitts and Nevis';
  ELSIF v IN ('saint lucia','st lucia','st. lucia') THEN
    RETURN 'Saint Lucia';
  ELSIF v IN ('saint vincent and the grenadines','st vincent and the grenadines','st. vincent and the grenadines') THEN
    RETURN 'Saint Vincent and the Grenadines';
  ELSIF v IN ('democratic republic of congo','congo drc','dr congo') THEN
    RETURN 'Democratic Republic of the Congo';
  ELSIF v IN ('republic of the congo','congo') THEN
    RETURN 'Congo (Republic of the Congo)';
  ELSE
    RETURN NULL;
  END IF;
END;
$$;

-- 2) Normalize invalid values where possible
DO $$
DECLARE col_is_enum boolean; BEGIN
  SELECT (data_type = 'USER-DEFINED' AND udt_name = 'countries') INTO col_is_enum
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='contacts' AND column_name='primary_country';
  IF NOT col_is_enum THEN
    UPDATE public.contacts
      SET primary_country = public.normalize_country(primary_country)
    WHERE primary_country IS NOT NULL
      AND NOT public.is_valid_country(primary_country::text)
      AND public.normalize_country(primary_country) IS NOT NULL;
  END IF;
END $$;

DO $$
DECLARE col_is_enum boolean; BEGIN
  SELECT (data_type = 'USER-DEFINED' AND udt_name = 'countries') INTO col_is_enum
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='contacts' AND column_name='alt_country';
  IF NOT col_is_enum THEN
    UPDATE public.contacts
      SET alt_country = public.normalize_country(alt_country)
    WHERE alt_country IS NOT NULL
      AND NOT public.is_valid_country(alt_country::text)
      AND public.normalize_country(alt_country) IS NOT NULL;
  END IF;
END $$;

DO $$
DECLARE col_is_enum boolean; BEGIN
  SELECT (data_type = 'USER-DEFINED' AND udt_name = 'countries') INTO col_is_enum
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='owners' AND column_name='tax_country';
  IF NOT col_is_enum THEN
    UPDATE public.owners
      SET tax_country = public.normalize_country(tax_country)
    WHERE tax_country IS NOT NULL
      AND NOT public.is_valid_country(tax_country::text)
      AND public.normalize_country(tax_country) IS NOT NULL;
  END IF;
END $$;

DO $$
DECLARE col_is_enum boolean; BEGIN
  SELECT (data_type = 'USER-DEFINED' AND udt_name = 'countries') INTO col_is_enum
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='properties' AND column_name='country';
  IF NOT col_is_enum THEN
    UPDATE public.properties
      SET country = public.normalize_country(country)
    WHERE country IS NOT NULL
      AND NOT public.is_valid_country(country::text)
      AND public.normalize_country(country) IS NOT NULL;
  END IF;
END $$;

DO $$
DECLARE col_is_enum boolean; BEGIN
  SELECT (data_type = 'USER-DEFINED' AND udt_name = 'countries') INTO col_is_enum
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='units' AND column_name='country';
  IF NOT col_is_enum THEN
    UPDATE public.units
      SET country = public.normalize_country(country)
    WHERE country IS NOT NULL
      AND NOT public.is_valid_country(country::text)
      AND public.normalize_country(country) IS NOT NULL;
  END IF;
END $$;

DO $$
DECLARE col_is_enum boolean; BEGIN
  SELECT (data_type = 'USER-DEFINED' AND udt_name = 'countries') INTO col_is_enum
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='vendors' AND column_name='country';
  IF NOT col_is_enum THEN
    UPDATE public.vendors
      SET country = public.normalize_country(country)
    WHERE country IS NOT NULL
      AND NOT public.is_valid_country(country::text)
      AND public.normalize_country(country) IS NOT NULL;
  END IF;
END $$;

-- 3) Convert to enum if fully clean: validate constraints, alter types, drop constraints
-- Overload for enum argument to support validating existing constraints on enum-typed columns
CREATE OR REPLACE FUNCTION public.is_valid_country(val public.countries)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$ SELECT TRUE $$;

DO $$
DECLARE
  invalid_count bigint;
BEGIN
  SELECT
    (SELECT COUNT(*) FROM public.contacts WHERE NOT public.is_valid_country(primary_country::text)) +
    (SELECT COUNT(*) FROM public.contacts WHERE NOT public.is_valid_country(alt_country::text)) +
    (SELECT COUNT(*) FROM public.owners WHERE NOT public.is_valid_country(tax_country::text)) +
    (SELECT COUNT(*) FROM public.properties WHERE NOT public.is_valid_country(country::text)) +
    (SELECT COUNT(*) FROM public.units WHERE NOT public.is_valid_country(country::text)) +
    (SELECT COUNT(*) FROM public.vendors WHERE NOT public.is_valid_country(country::text))
  INTO invalid_count;
  IF invalid_count = 0 THEN
    -- Drop report view prior to type changes to avoid dependency errors
    DROP VIEW IF EXISTS public.invalid_country_values;
    -- validate staged constraints (should be no-op if clean)
    ALTER TABLE public.contacts VALIDATE CONSTRAINT contacts_primary_country_is_valid;
    ALTER TABLE public.contacts VALIDATE CONSTRAINT contacts_alt_country_is_valid;
    ALTER TABLE public.owners VALIDATE CONSTRAINT owners_tax_country_is_valid;
    ALTER TABLE public.properties VALIDATE CONSTRAINT properties_country_is_valid;
    ALTER TABLE public.units VALIDATE CONSTRAINT units_country_is_valid;
    ALTER TABLE public.vendors VALIDATE CONSTRAINT vendors_country_is_valid;

    -- convert to enum types if not already
    PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='primary_country' AND data_type='USER-DEFINED' AND udt_name='countries';
    IF NOT FOUND THEN
      -- drop default before type change to avoid cast error
      ALTER TABLE public.contacts ALTER COLUMN primary_country DROP DEFAULT;
      ALTER TABLE public.contacts
        ALTER COLUMN primary_country TYPE public.countries USING primary_country::public.countries;
      -- restore enum-typed default
      ALTER TABLE public.contacts
        ALTER COLUMN primary_country SET DEFAULT 'United States'::public.countries;
    END IF;
    PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='alt_country' AND data_type='USER-DEFINED' AND udt_name='countries';
    IF NOT FOUND THEN
      ALTER TABLE public.contacts
        ALTER COLUMN alt_country TYPE public.countries USING alt_country::public.countries;
    END IF;

    PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='owners' AND column_name='tax_country' AND data_type='USER-DEFINED' AND udt_name='countries';
    IF NOT FOUND THEN
      ALTER TABLE public.owners
        ALTER COLUMN tax_country TYPE public.countries USING tax_country::public.countries;
    END IF;

    PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='properties' AND column_name='country' AND data_type='USER-DEFINED' AND udt_name='countries';
    IF NOT FOUND THEN
      ALTER TABLE public.properties
        ALTER COLUMN country TYPE public.countries USING country::public.countries;
    END IF;

    PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='units' AND column_name='country' AND data_type='USER-DEFINED' AND udt_name='countries';
    IF NOT FOUND THEN
      ALTER TABLE public.units
        ALTER COLUMN country TYPE public.countries USING country::public.countries;
    END IF;

    PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='vendors' AND column_name='country' AND data_type='USER-DEFINED' AND udt_name='countries';
    IF NOT FOUND THEN
      ALTER TABLE public.vendors
        ALTER COLUMN country TYPE public.countries USING country::public.countries;
    END IF;

    -- drop CHECK constraints (enum enforces domain)
    ALTER TABLE public.contacts
      DROP CONSTRAINT IF EXISTS contacts_primary_country_is_valid,
      DROP CONSTRAINT IF EXISTS contacts_alt_country_is_valid;
    ALTER TABLE public.owners
      DROP CONSTRAINT IF EXISTS owners_tax_country_is_valid;
    ALTER TABLE public.properties
      DROP CONSTRAINT IF EXISTS properties_country_is_valid;
    ALTER TABLE public.units
      DROP CONSTRAINT IF EXISTS units_country_is_valid;
    ALTER TABLE public.vendors
      DROP CONSTRAINT IF EXISTS vendors_country_is_valid;

    -- ensure default is enum-typed
    ALTER TABLE public.contacts
      ALTER COLUMN primary_country SET DEFAULT 'United States'::public.countries;

    -- Recreate report view (will typically be empty after conversion)
    CREATE OR REPLACE VIEW public.invalid_country_values AS
      SELECT 'contacts'::text AS table_name, id::text AS id, 'primary_country'::text AS column_name, primary_country AS value
      FROM public.contacts WHERE NOT public.is_valid_country(primary_country::text)
      UNION ALL
      SELECT 'contacts', id::text, 'alt_country', alt_country
      FROM public.contacts WHERE NOT public.is_valid_country(alt_country::text)
      UNION ALL
      SELECT 'owners', id::text, 'tax_country', tax_country
      FROM public.owners WHERE NOT public.is_valid_country(tax_country::text)
      UNION ALL
      SELECT 'properties', id::text, 'country', country
      FROM public.properties WHERE NOT public.is_valid_country(country::text)
      UNION ALL
      SELECT 'units', id::text, 'country', country
      FROM public.units WHERE NOT public.is_valid_country(country::text)
      UNION ALL
      SELECT 'vendors', id::text, 'country', country
      FROM public.vendors WHERE NOT public.is_valid_country(country::text);
  END IF;
END
$$;
