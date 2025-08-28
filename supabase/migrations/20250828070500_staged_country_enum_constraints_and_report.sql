-- Staged country normalization (non-destructive)
-- - Ensure countries enum exists
-- - Add NOT VALID check constraints to guide normalization
-- - Provide a reporting view listing invalid country values across key tables
-- - Adjust default for contacts.primary_country to a normalized text value

-- 1) Ensure countries enum exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'countries'
  ) THEN
    CREATE TYPE public.countries AS ENUM (
      'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cambodia','Cameroon','Canada','Cape Verde','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo (Republic of the Congo)','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic (Czechia)','Democratic Republic of the Congo','Denmark','Djibouti','Dominica','Dominican Republic','East Timor (Timor-Leste)','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Ivory Coast (Côte d''Ivoire)','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Korea (North Korea)','Korea (South Korea)','Kosovo','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Martinique','Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar (Burma)','Namibia','Nauru','Nepal','Netherlands','New Caledonia','New Zealand','Nicaragua','Niger','Nigeria','North Macedonia','Norway','Oman','Pakistan','Palau','Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','São Tomé and Príncipe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu','Vatican City (Holy See)','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'
    );
    COMMENT ON TYPE public.countries IS 'Comprehensive list of world countries for standardization';
  END IF;
END
$$;

-- 2) Utility function to test if a text value is a valid country enum label
CREATE OR REPLACE FUNCTION public.is_valid_country(val text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v public.countries;
BEGIN
  IF val IS NULL THEN
    RETURN true;
  END IF;
  BEGIN
    v := val::public.countries;
    RETURN true;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;
END;
$$;

-- 3) Add NOT VALID constraints to key country columns (non-blocking)
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_primary_country_is_valid CHECK (public.is_valid_country(primary_country::text)) NOT VALID,
  ADD CONSTRAINT contacts_alt_country_is_valid CHECK (public.is_valid_country(alt_country::text)) NOT VALID;

ALTER TABLE public.owners
  ADD CONSTRAINT owners_tax_country_is_valid CHECK (public.is_valid_country(tax_country::text)) NOT VALID;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_country_is_valid CHECK (public.is_valid_country(country::text)) NOT VALID;

ALTER TABLE public.units
  ADD CONSTRAINT units_country_is_valid CHECK (public.is_valid_country(country::text)) NOT VALID;

ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_country_is_valid CHECK (public.is_valid_country(country::text)) NOT VALID;

-- 4) Helpful reporting view to identify invalid values (casts ids to text)
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

COMMENT ON VIEW public.invalid_country_values IS 'Lists rows/columns where country values are not valid enum labels; use to drive normalization before converting types.';

-- 5) Nudge default toward normalized value (still text here)
DO $$
DECLARE
  col_is_enum boolean;
BEGIN
  SELECT (data_type = 'USER-DEFINED' AND udt_name = 'countries')
  INTO col_is_enum
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'primary_country';

  IF col_is_enum THEN
    EXECUTE 'ALTER TABLE public.contacts ALTER COLUMN primary_country SET DEFAULT ''United States''::public.countries';
  ELSE
    EXECUTE 'ALTER TABLE public.contacts ALTER COLUMN primary_country SET DEFAULT ''United States''';
  END IF;
END
$$;
