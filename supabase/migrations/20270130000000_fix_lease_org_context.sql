-- Ensure lease creation functions propagate org_id to lease_contacts and derive org context from property when missing

CREATE OR REPLACE FUNCTION public.fn_create_lease_aggregate(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_lease_id integer;
  v_now timestamptz := now();
  v_org uuid;
  v_property_id uuid;
  v_unit_id uuid;
BEGIN
  v_property_id := NULLIF(payload->'lease'->>'property_id','')::uuid;
  v_unit_id := NULLIF(payload->'lease'->>'unit_id','')::uuid;
  v_org := NULLIF(payload->'lease'->>'org_id','')::uuid;

  -- Derive org from property when not supplied in payload
  IF v_org IS NULL AND v_property_id IS NOT NULL THEN
    SELECT org_id INTO v_org FROM public.properties WHERE id = v_property_id;
  END IF;
  -- Fallback: derive org from unit if property org is missing
  IF v_org IS NULL AND v_unit_id IS NOT NULL THEN
    SELECT org_id INTO v_org FROM public.units WHERE id = v_unit_id;
    -- If unit has org but property is missing, also try to resolve property_id from the unit
    IF v_property_id IS NULL THEN
      SELECT property_id INTO v_property_id FROM public.units WHERE id = v_unit_id;
    END IF;
  END IF;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'lease_contacts: org_id cannot be null once backfilled';
  END IF;

  -- Insert lease with org context
  INSERT INTO public.lease (
    property_id, unit_id, lease_from_date, lease_to_date, lease_type,
    payment_due_day, security_deposit, rent_amount,
    prorated_first_month_rent, prorated_last_month_rent,
    renewal_offer_status, status, org_id, created_at, updated_at
  ) VALUES (
    v_property_id,
    NULLIF(payload->'lease'->>'unit_id','')::uuid,
    (payload->'lease'->>'lease_from_date')::date,
    NULLIF(payload->'lease'->>'lease_to_date','')::date,
    NULLIF(payload->'lease'->>'lease_type',''),
    NULLIF(payload->'lease'->>'payment_due_day','')::int,
    NULLIF(payload->'lease'->>'security_deposit','')::numeric,
    NULLIF(payload->'lease'->>'rent_amount','')::numeric,
    NULLIF(payload->'lease'->>'prorated_first_month_rent','')::numeric,
    NULLIF(payload->'lease'->>'prorated_last_month_rent','')::numeric,
    NULLIF(payload->'lease'->>'renewal_offer_status',''),
    COALESCE(NULLIF(payload->'lease'->>'status',''), 'active'),
    v_org,
    v_now, v_now
  ) RETURNING id INTO v_lease_id;

  -- Contacts (inherit org)
  INSERT INTO public.lease_contacts (
    lease_id, tenant_id, role, status, move_in_date, move_out_date, notice_given_date, is_rent_responsible, org_id, created_at, updated_at
  )
  SELECT v_lease_id,
         (c->>'tenant_id')::uuid,
         COALESCE(NULLIF(c->>'role',''),'Tenant')::public.lease_contact_role_enum,
         COALESCE(NULLIF(c->>'status',''),'Active')::public.lease_contact_status_enum,
         NULLIF(c->>'move_in_date','')::date,
         NULLIF(c->>'move_out_date','')::date,
         NULLIF(c->>'notice_given_date','')::date,
         COALESCE((c->>'is_rent_responsible')::boolean, false),
         v_org,
         v_now, v_now
  FROM jsonb_array_elements(COALESCE(payload->'contacts','[]'::jsonb)) AS c;

  -- Rent schedules
  INSERT INTO public.rent_schedules (
    lease_id, start_date, end_date, total_amount, rent_cycle, backdate_charges, created_at, updated_at
  )
  SELECT v_lease_id,
         (s->>'start_date')::date,
         NULLIF(s->>'end_date','')::date,
         NULLIF(s->>'total_amount','')::numeric,
         COALESCE(NULLIF(s->>'rent_cycle',''),'Monthly')::public.rent_cycle_enum,
         COALESCE((s->>'backdate_charges')::boolean, false),
         v_now, v_now
  FROM jsonb_array_elements(COALESCE(payload->'rent_schedules','[]'::jsonb)) AS s;

  -- Recurring templates
  INSERT INTO public.recurring_transactions (
    lease_id, frequency, amount, memo, start_date, end_date, created_at, updated_at
  )
  SELECT v_lease_id,
         COALESCE(NULLIF(r->>'frequency',''),'Monthly')::public.rent_cycle_enum,
         NULLIF(r->>'amount','')::numeric,
         NULLIF(r->>'memo',''),
         NULLIF(r->>'start_date','')::date,
         NULLIF(r->>'end_date','')::date,
         v_now, v_now
  FROM jsonb_array_elements(COALESCE(payload->'recurring_transactions','[]'::jsonb)) AS r;

  -- Documents metadata → unified files
  WITH docs AS (
    SELECT d, row_number() OVER () AS rn
    FROM jsonb_array_elements(COALESCE(payload->'documents','[]'::jsonb)) AS d
  ), inserted AS (
    INSERT INTO public.files (
      org_id, source, storage_provider, bucket, storage_key,
      file_name, mime_type, size_bytes, sha256, is_private,
      description, created_at, updated_at
    )
    SELECT v_org,
           'local',
           'supabase',
           'lease-documents',
           (d.d->>'storage_path'),
           (d.d->>'name'),
           NULLIF(d.d->>'mime_type',''),
           NULLIF(d.d->>'size_bytes','')::int,
           NULLIF(d.d->>'sha256',''),
           COALESCE((d.d->>'is_private')::boolean, true),
           NULL,
           v_now, v_now
    FROM docs d
    RETURNING id, storage_key
  )
  INSERT INTO public.file_links (file_id, entity_type, entity_int, org_id, role, category, added_at)
  SELECT i.id, 'lease', v_lease_id, v_org, 'document', NULLIF(d.d->>'category',''), v_now
  FROM inserted i
  JOIN docs d ON i.storage_key = (d.d->>'storage_path');

  RETURN jsonb_build_object('lease_id', v_lease_id);
EXCEPTION WHEN others THEN
  RAISE;
END;
$$;

-- Update wrapper to persist org_id back into payload before aggregate insert
CREATE OR REPLACE FUNCTION public.fn_create_lease_full(payload jsonb, new_people jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_contacts jsonb := coalesce(payload->'contacts','[]'::jsonb);
  v_person jsonb;
  v_contact_id bigint;
  v_tenant_id uuid;
  v_now timestamptz := now();
  v_property_id uuid := nullif(payload->'lease'->>'property_id','')::uuid;
  v_unit_id uuid := nullif(payload->'lease'->>'unit_id','')::uuid;
  v_org_id uuid := nullif(payload->'lease'->>'org_id','')::uuid;
  v_addr1 text; v_addr2 text; v_city text; v_state text; v_postal text; v_country text; v_unit_num text;
BEGIN
  -- Preload property/unit address + org context
  IF v_property_id IS NOT NULL THEN
    SELECT address_line1, address_line2, city, state, postal_code, country, org_id
      INTO v_addr1, v_addr2, v_city, v_state, v_postal, v_country, v_org_id
    FROM public.properties
    WHERE id = v_property_id;
  END IF;
  IF v_unit_id IS NOT NULL THEN
    SELECT unit_number, property_id INTO v_unit_num, v_property_id
    FROM public.units
    WHERE id = v_unit_id;
    -- Prefer org_id directly on the unit if present
    IF v_org_id IS NULL THEN
      SELECT org_id INTO v_org_id FROM public.units WHERE id = v_unit_id;
    END IF;
    IF v_property_id IS NOT NULL AND v_org_id IS NULL THEN
      SELECT org_id
        INTO v_org_id
      FROM public.properties
      WHERE id = v_property_id;
    END IF;
  END IF;

  IF v_org_id IS NOT NULL THEN
    payload := jsonb_set(payload, '{lease,org_id}', to_jsonb(v_org_id)::jsonb, true);
  END IF;

  -- Create contacts/tenants for staged people
  FOR v_person IN SELECT value FROM jsonb_array_elements(coalesce(new_people,'[]'::jsonb))
  LOOP
    INSERT INTO public.contacts (
      is_company, first_name, last_name,
      primary_email, primary_phone, alt_phone, alt_email,
      primary_address_line_1, primary_address_line_2, primary_city, primary_state, primary_postal_code, primary_country,
      alt_address_line_1, alt_address_line_2, alt_city, alt_state, alt_postal_code, alt_country
    ) VALUES (
      false,
      nullif(v_person->>'first_name',''),
      nullif(v_person->>'last_name',''),
      nullif(v_person->>'email',''),
      nullif(v_person->>'phone',''),
      nullif(v_person->>'alt_phone',''),
      nullif(v_person->>'alt_email',''),
      CASE WHEN coalesce(v_person->>'same_as_unit','false') = 'true'
             OR (coalesce(v_person->>'addr1','') = '' AND coalesce(v_person->>'city','')='' AND coalesce(v_person->>'state','')='' AND coalesce(v_person->>'postal','')='' AND coalesce(v_person->>'country','')='')
           THEN v_addr1 ELSE nullif(v_person->>'addr1','') END,
      CASE WHEN coalesce(v_person->>'same_as_unit','false') = 'true'
             OR (coalesce(v_person->>'addr1','') = '' AND coalesce(v_person->>'city','')='' AND coalesce(v_person->>'state','')='' AND coalesce(v_person->>'postal','')='' AND coalesce(v_person->>'country','')='')
           THEN coalesce(v_addr2, CASE WHEN v_unit_num IS NOT NULL THEN 'Unit ' || v_unit_num ELSE NULL END)
           ELSE nullif(v_person->>'addr2','') END,
      CASE WHEN coalesce(v_person->>'same_as_unit','false') = 'true'
             OR (coalesce(v_person->>'addr1','') = '' AND coalesce(v_person->>'city','')='' AND coalesce(v_person->>'state','')='' AND coalesce(v_person->>'postal','')='' AND coalesce(v_person->>'country','')='')
           THEN v_city ELSE nullif(v_person->>'city','') END,
      CASE WHEN coalesce(v_person->>'same_as_unit','false') = 'true'
             OR (coalesce(v_person->>'addr1','') = '' AND coalesce(v_person->>'city','')='' AND coalesce(v_person->>'state','')='' AND coalesce(v_person->>'postal','')='' AND coalesce(v_person->>'country','')='')
           THEN v_state ELSE nullif(v_person->>'state','') END,
      CASE WHEN coalesce(v_person->>'same_as_unit','false') = 'true'
             OR (coalesce(v_person->>'addr1','') = '' AND coalesce(v_person->>'city','')='' AND coalesce(v_person->>'state','')='' AND coalesce(v_person->>'postal','')='' AND coalesce(v_person->>'country','')='')
           THEN v_postal ELSE nullif(v_person->>'postal','') END,
      CASE WHEN coalesce(v_person->>'same_as_unit','false') = 'true'
             OR (coalesce(v_person->>'addr1','') = '' AND coalesce(v_person->>'city','')='' AND coalesce(v_person->>'state','')='' AND coalesce(v_person->>'postal','')='' AND coalesce(v_person->>'country','')='')
           THEN (
             SELECT enumlabel::public.countries
             FROM pg_enum e
             JOIN pg_type t ON e.enumtypid = t.oid
             WHERE t.typname = 'countries'
               AND lower(enumlabel) = lower(v_country)
             LIMIT 1
           )
           ELSE (
             SELECT enumlabel::public.countries
             FROM pg_enum e
             JOIN pg_type t ON e.enumtypid = t.oid
             WHERE t.typname = 'countries'
               AND lower(enumlabel) = lower(nullif(v_person->>'country',''))
             LIMIT 1
           ) END,
      nullif(v_person->>'alt_addr1',''),
      nullif(v_person->>'alt_addr2',''),
      nullif(v_person->>'alt_city',''),
      nullif(v_person->>'alt_state',''),
      nullif(v_person->>'alt_postal',''),
      (
        SELECT enumlabel::public.countries
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'countries'
          AND lower(enumlabel) = lower(nullif(v_person->>'alt_country',''))
        LIMIT 1
      )
    ) RETURNING id INTO v_contact_id;

    INSERT INTO public.tenants (contact_id, org_id, created_at, updated_at)
    VALUES (v_contact_id, v_org_id, v_now, v_now)
    RETURNING id INTO v_tenant_id;

    v_contacts := v_contacts || jsonb_build_array(jsonb_build_object(
      'tenant_id', v_tenant_id,
      'role', coalesce(v_person->>'role','Tenant'),
      'is_rent_responsible', (coalesce(v_person->>'role','Tenant') = 'Tenant')
    ));
  END LOOP;

  payload := jsonb_set(payload, '{contacts}', v_contacts, true);

  RETURN public.fn_create_lease_aggregate(payload);
END;
$$;
