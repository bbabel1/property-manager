-- Fix Supabase lint errors on legacy Buildium mapping/cache helpers by making them
-- resilient to schema drift (tables/columns removed) and safe to re-run.

BEGIN;

-- Helper to see if a column exists.
CREATE OR REPLACE FUNCTION public._column_exists(p_schema text, p_table text, p_column text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = p_schema
      AND table_name = p_table
      AND column_name = p_column
  );
$$;

-- Map bill to Buildium payload; skip if bills table is absent.
CREATE OR REPLACE FUNCTION public.map_bill_to_buildium(p_bill_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  bill jsonb;
BEGIN
  IF to_regclass('public.bills') IS NULL THEN
    RAISE NOTICE 'bills table not present; returning NULL payload';
    RETURN NULL;
  END IF;

  EXECUTE 'SELECT to_jsonb(b) FROM public.bills b WHERE b.id = $1'
    INTO bill USING p_bill_id;

  IF bill IS NULL THEN
    RAISE EXCEPTION 'Bill with ID % not found', p_bill_id;
  END IF;

  RETURN jsonb_build_object(
    'VendorId', (bill->>'vendor_id')::uuid,
    'PropertyId', (bill->>'property_id')::uuid,
    'UnitId', (bill->>'unit_id')::uuid,
    'Date', (bill->>'date')::date,
    'DueDate', (bill->>'due_date')::date,
    'Amount', (bill->>'amount')::numeric,
    'Description', bill->>'description',
    'ReferenceNumber', COALESCE(bill->>'reference_number', ''),
    'CategoryId', (bill->>'category_id')::uuid,
    'IsRecurring', COALESCE((bill->>'is_recurring')::boolean, false),
    'RecurringSchedule', bill->'recurring_schedule'
  );
END;
$$;

-- Map owner; tolerate missing columns by reading from jsonb.
CREATE OR REPLACE FUNCTION public.map_owner_to_buildium(p_owner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  owner jsonb;
BEGIN
  IF to_regclass('public.owners') IS NULL THEN
    RAISE NOTICE 'owners table not present; returning NULL payload';
    RETURN NULL;
  END IF;

  EXECUTE 'SELECT to_jsonb(o) FROM public.owners o WHERE o.id = $1'
    INTO owner USING p_owner_id;

  IF owner IS NULL THEN
    RAISE EXCEPTION 'Owner with ID % not found', p_owner_id;
  END IF;

  RETURN jsonb_build_object(
    'FirstName', COALESCE(owner->>'first_name', ''),
    'LastName', COALESCE(owner->>'last_name', ''),
    'Email', COALESCE(owner->>'email', ''),
    'PhoneNumber', COALESCE(owner->>'phone_home', owner->>'phone_mobile', ''),
    'Address', jsonb_build_object(
      'AddressLine1', owner->>'address_line1',
      'AddressLine2', COALESCE(owner->>'address_line2', ''),
      'City', COALESCE(owner->>'city', ''),
      'State', COALESCE(owner->>'state', ''),
      'PostalCode', owner->>'postal_code',
      'Country', COALESCE(owner->>'country', 'United States')
    ),
    'TaxId', COALESCE(owner->>'tax_id', ''),
    'IsActive', COALESCE((owner->>'is_active')::boolean, true)
  );
END;
$$;

-- Map property; ignore square_footage if the column is absent.
CREATE OR REPLACE FUNCTION public.map_property_to_buildium(p_property_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  prop jsonb;
BEGIN
  IF to_regclass('public.properties') IS NULL THEN
    RAISE NOTICE 'properties table not present; returning NULL payload';
    RETURN NULL;
  END IF;

  EXECUTE 'SELECT to_jsonb(p) FROM public.properties p WHERE p.id = $1'
    INTO prop USING p_property_id;

  IF prop IS NULL THEN
    RAISE EXCEPTION 'Property with ID % not found', p_property_id;
  END IF;

  RETURN jsonb_build_object(
    'Name', prop->>'name',
    'Address', jsonb_build_object(
      'AddressLine1', prop->>'address_line1',
      'AddressLine2', COALESCE(prop->>'address_line2', ''),
      'City', COALESCE(prop->>'city', ''),
      'State', COALESCE(prop->>'state', ''),
      'PostalCode', prop->>'postal_code',
      'Country', COALESCE(prop->>'country', 'United States')
    ),
    'PropertyType', COALESCE(prop->>'property_type', 'MultiFamilyTwoToFourUnits'),
    'YearBuilt', (prop->>'year_built')::integer,
    'SquareFootage', COALESCE(NULLIF(prop->>'square_footage', '')::integer, NULLIF(prop->>'unit_size', '')::integer),
    'Bedrooms', prop->>'bedrooms',
    'Bathrooms', prop->>'bathrooms',
    'Description', COALESCE(prop->>'structure_description', ''),
    'IsActive', COALESCE((prop->>'is_active')::boolean, true)
  );
END;
$$;

-- Map vendor; avoid enum issues by defaulting country when blank.
CREATE OR REPLACE FUNCTION public.map_vendor_to_buildium(p_vendor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  vendor jsonb;
  country text;
BEGIN
  IF to_regclass('public.vendors') IS NULL THEN
    RAISE NOTICE 'vendors table not present; returning NULL payload';
    RETURN NULL;
  END IF;

  EXECUTE 'SELECT to_jsonb(v) FROM public.vendors v WHERE v.id = $1'
    INTO vendor USING p_vendor_id;

  IF vendor IS NULL THEN
    RAISE EXCEPTION 'Vendor with ID % not found', p_vendor_id;
  END IF;

  country := COALESCE(NULLIF(vendor->>'country', ''), 'United States');

  RETURN jsonb_build_object(
    'Name', vendor->>'name',
    'CategoryId', (vendor->>'category_id')::integer,
    'ContactName', COALESCE(vendor->>'contact_name', ''),
    'Email', COALESCE(vendor->>'email', ''),
    'PhoneNumber', COALESCE(vendor->>'phone_number', ''),
    'Address', jsonb_build_object(
      'AddressLine1', COALESCE(vendor->>'address_line1', ''),
      'AddressLine2', COALESCE(vendor->>'address_line2', ''),
      'City', COALESCE(vendor->>'city', ''),
      'State', COALESCE(vendor->>'state', ''),
      'PostalCode', COALESCE(vendor->>'postal_code', ''),
      'Country', country
    ),
    'TaxId', COALESCE(vendor->>'tax_id', ''),
    'Notes', COALESCE(vendor->>'notes', ''),
    'IsActive', COALESCE((vendor->>'is_active')::boolean, true)
  );
END;
$$;

-- set_buildium_property_id: ignore entity_type when the column is absent.
CREATE OR REPLACE FUNCTION public.set_buildium_property_id(p_entity_id uuid, p_buildium_property_id integer, p_entity_type text)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  has_entity_type boolean;
  sql text;
BEGIN
  IF to_regclass('public.properties') IS NULL THEN
    RAISE NOTICE 'properties table not present; skipping update';
    RETURN;
  END IF;

  has_entity_type := public._column_exists('public', 'properties', 'entity_type');

  sql := 'UPDATE public.properties SET buildium_property_id = $1 WHERE id = $2';
  IF has_entity_type THEN
    sql := sql || ' AND entity_type = $3';
    EXECUTE sql USING p_buildium_property_id, p_entity_id, p_entity_type;
  ELSE
    EXECUTE sql USING p_buildium_property_id, p_entity_id;
  END IF;
END;
$$;

-- set_buildium_api_cache: no unique constraint on endpoint/parameters, so use DO NOTHING.
CREATE OR REPLACE FUNCTION public.set_buildium_api_cache(
  p_endpoint character varying,
  p_parameters jsonb,
  p_response_data jsonb,
  p_cache_duration_minutes integer DEFAULT 60
) RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF to_regclass('public.buildium_api_cache') IS NULL THEN
    RAISE NOTICE 'buildium_api_cache table not present; skipping cache write';
    RETURN;
  END IF;

  INSERT INTO public.buildium_api_cache (
    endpoint,
    parameters,
    response_data,
    expires_at,
    created_at
  )
  VALUES (
    p_endpoint,
    p_parameters,
    p_response_data,
    now() + (p_cache_duration_minutes || ' minutes')::interval,
    now()
  )
  ON CONFLICT DO NOTHING;
END;
$$;

-- update_buildium_sync_status: fall back to DO NOTHING if unique constraint is missing.
CREATE OR REPLACE FUNCTION public.update_buildium_sync_status(
  p_entity_type character varying,
  p_entity_id uuid,
  p_buildium_id integer,
  p_status character varying,
  p_error_message text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  has_unique boolean;
BEGIN
  IF to_regclass('public.buildium_sync_status') IS NULL THEN
    RAISE NOTICE 'buildium_sync_status table not present; skipping update';
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'buildium_sync_status_entity_unique'
      AND conrelid = 'public.buildium_sync_status'::regclass
  ) INTO has_unique;

  IF has_unique THEN
    INSERT INTO public.buildium_sync_status (
      entity_type, entity_id, buildium_id, sync_status, error_message, last_synced_at
    ) VALUES (
      p_entity_type, p_entity_id, p_buildium_id, p_status, p_error_message, now()
    )
    ON CONFLICT ON CONSTRAINT buildium_sync_status_entity_unique DO UPDATE
      SET buildium_id = EXCLUDED.buildium_id,
          sync_status = EXCLUDED.sync_status,
          error_message = EXCLUDED.error_message,
          last_synced_at = EXCLUDED.last_synced_at;
  ELSE
    INSERT INTO public.buildium_sync_status (
      entity_type, entity_id, buildium_id, sync_status, error_message, last_synced_at
    ) VALUES (
      p_entity_type, p_entity_id, p_buildium_id, p_status, p_error_message, now()
    )
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

COMMIT;
