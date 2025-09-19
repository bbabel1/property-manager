-- Non-destructive alignment migration
-- Goal: Align remote schema with local expectations without dropping or changing existing remote data types.
-- Actions:
--  - Add back missing columns used locally (snake_case timestamps, units.building_name)
--  - Ensure countries enum type exists (no type changes applied here)
--  - Add sync triggers to mirror camelCase and snake_case timestamp fields

-- 1) Ensure countries enum exists (no type coercion here)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'countries'
  ) THEN
    CREATE TYPE "public"."countries" AS ENUM (
      'Afghanistan',
      'Albania',
      'Algeria',
      'Andorra',
      'Angola',
      'Antigua and Barbuda',
      'Argentina',
      'Armenia',
      'Australia',
      'Austria',
      'Azerbaijan',
      'Bahamas',
      'Bahrain',
      'Bangladesh',
      'Barbados',
      'Belarus',
      'Belgium',
      'Belize',
      'Benin',
      'Bhutan',
      'Bolivia',
      'Bosnia and Herzegovina',
      'Botswana',
      'Brazil',
      'Brunei',
      'Bulgaria',
      'Burkina Faso',
      'Burundi',
      'Cambodia',
      'Cameroon',
      'Canada',
      'Cape Verde',
      'Central African Republic',
      'Chad',
      'Chile',
      'China',
      'Colombia',
      'Comoros',
      'Congo (Republic of the Congo)',
      'Costa Rica',
      'Croatia',
      'Cuba',
      'Cyprus',
      'Czech Republic (Czechia)',
      'Democratic Republic of the Congo',
      'Denmark',
      'Djibouti',
      'Dominica',
      'Dominican Republic',
      'East Timor (Timor-Leste)',
      'Ecuador',
      'Egypt',
      'El Salvador',
      'Equatorial Guinea',
      'Eritrea',
      'Estonia',
      'Eswatini',
      'Ethiopia',
      'Fiji',
      'Finland',
      'France',
      'Gabon',
      'Gambia',
      'Georgia',
      'Germany',
      'Ghana',
      'Greece',
      'Grenada',
      'Guatemala',
      'Guinea',
      'Guinea-Bissau',
      'Guyana',
      'Haiti',
      'Honduras',
      'Hungary',
      'Iceland',
      'India',
      'Indonesia',
      'Iran',
      'Iraq',
      'Ireland',
      'Israel',
      'Italy',
      'Ivory Coast (Côte d''Ivoire)',
      'Jamaica',
      'Japan',
      'Jordan',
      'Kazakhstan',
      'Kenya',
      'Kiribati',
      'Korea (North Korea)',
      'Korea (South Korea)',
      'Kosovo',
      'Kuwait',
      'Kyrgyzstan',
      'Laos',
      'Latvia',
      'Lebanon',
      'Lesotho',
      'Liberia',
      'Libya',
      'Liechtenstein',
      'Lithuania',
      'Luxembourg',
      'Madagascar',
      'Malawi',
      'Malaysia',
      'Maldives',
      'Mali',
      'Malta',
      'Marshall Islands',
      'Martinique',
      'Mauritania',
      'Mauritius',
      'Mexico',
      'Micronesia',
      'Moldova',
      'Monaco',
      'Mongolia',
      'Montenegro',
      'Morocco',
      'Mozambique',
      'Myanmar (Burma)',
      'Namibia',
      'Nauru',
      'Nepal',
      'Netherlands',
      'New Caledonia',
      'New Zealand',
      'Nicaragua',
      'Niger',
      'Nigeria',
      'North Macedonia',
      'Norway',
      'Oman',
      'Pakistan',
      'Palau',
      'Palestine',
      'Panama',
      'Papua New Guinea',
      'Paraguay',
      'Peru',
      'Philippines',
      'Poland',
      'Portugal',
      'Qatar',
      'Romania',
      'Russia',
      'Rwanda',
      'Saint Kitts and Nevis',
      'Saint Lucia',
      'Saint Vincent and the Grenadines',
      'Samoa',
      'San Marino',
      'São Tomé and Príncipe',
      'Saudi Arabia',
      'Senegal',
      'Serbia',
      'Seychelles',
      'Sierra Leone',
      'Singapore',
      'Slovakia',
      'Slovenia',
      'Solomon Islands',
      'Somalia',
      'South Africa',
      'South Sudan',
      'Spain',
      'Sri Lanka',
      'Sudan',
      'Suriname',
      'Sweden',
      'Switzerland',
      'Syria',
      'Taiwan',
      'Tajikistan',
      'Tanzania',
      'Thailand',
      'Togo',
      'Tonga',
      'Trinidad and Tobago',
      'Tunisia',
      'Turkey',
      'Turkmenistan',
      'Tuvalu',
      'Uganda',
      'Ukraine',
      'United Arab Emirates',
      'United Kingdom',
      'United States',
      'Uruguay',
      'Uzbekistan',
      'Vanuatu',
      'Vatican City (Holy See)',
      'Venezuela',
      'Vietnam',
      'Yemen',
      'Zambia',
      'Zimbabwe'
    );
    COMMENT ON TYPE "public"."countries" IS 'Comprehensive list of all world countries for standardized country selection';
  END IF;
END
$$;

-- 2) Add back missing fields used by local code
-- 2a) units.building_name
ALTER TABLE IF EXISTS "public"."units"
  ADD COLUMN IF NOT EXISTS "building_name" text;
COMMENT ON COLUMN "public"."units"."building_name" IS 'Building name for units in multi-building properties';

-- 2b) lease.created_at / lease.updated_at (snake_case) alongside existing camelCase
ALTER TABLE IF EXISTS "public"."lease"
  ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT NOW() NOT NULL;

-- Sync trigger for lease timestamps (bidirectional mirror)
CREATE OR REPLACE FUNCTION "public"."sync_lease_timestamps"()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := COALESCE(NEW.created_at, NEW."createdAt", NOW());
    NEW.updated_at := COALESCE(NEW.updated_at, NEW."updatedAt", NEW.created_at, NOW());
    NEW."createdAt" := COALESCE(NEW."createdAt", NEW.created_at);
    NEW."updatedAt" := COALESCE(NEW."updatedAt", NEW.updated_at);
  ELSE
    NEW.updated_at := COALESCE(NEW.updated_at, NOW());
    NEW."updatedAt" := NEW.updated_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'lease_timestamps_sync'
  ) THEN
    CREATE TRIGGER "lease_timestamps_sync"
    BEFORE INSERT OR UPDATE ON "public"."lease"
    FOR EACH ROW EXECUTE FUNCTION "public"."sync_lease_timestamps"();
  END IF;
END
$$;

-- 2c) staff.created_at / staff.updated_at (snake_case) alongside existing camelCase
ALTER TABLE IF EXISTS "public"."staff"
  ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT NOW() NOT NULL,
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT NOW() NOT NULL;

CREATE OR REPLACE FUNCTION "public"."sync_staff_timestamps"()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := COALESCE(NEW.created_at, NEW."createdAt", NOW());
    NEW.updated_at := COALESCE(NEW.updated_at, NEW."updatedAt", NEW.created_at, NOW());
    NEW."createdAt" := COALESCE(NEW."createdAt", NEW.created_at);
    NEW."updatedAt" := COALESCE(NEW."updatedAt", NEW.updated_at);
  ELSE
    NEW.updated_at := COALESCE(NEW.updated_at, NOW());
    NEW."updatedAt" := NEW.updated_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'staff_timestamps_sync'
  ) THEN
    CREATE TRIGGER "staff_timestamps_sync"
    BEFORE INSERT OR UPDATE ON "public"."staff"
    FOR EACH ROW EXECUTE FUNCTION "public"."sync_staff_timestamps"();
  END IF;
END
$$;

-- Notes:
--  - We deliberately do NOT drop or alter existing remote columns/types.
--  - Future phase can convert country columns to the enum once values are normalized.
--  - Triggers keep snake_case/camelCase timestamps in sync for lease and staff.

