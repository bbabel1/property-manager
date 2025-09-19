-- Wraps contact/tenant creation + lease aggregate in a single DB transaction
-- Usage: select * from public.fn_create_lease_full(payload := '{...}'::jsonb, new_people := '[...]'::jsonb);

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
  v_addr1 text; v_addr2 text; v_city text; v_state text; v_postal text; v_country text; v_unit_num text;
BEGIN
  -- Preload property/unit address context if available
  IF v_property_id IS NOT NULL THEN
    SELECT address_line1, address_line2, city, state, postal_code, country
      INTO v_addr1, v_addr2, v_city, v_state, v_postal, v_country
    FROM public.properties
    WHERE id = v_property_id;
  END IF;
  IF v_unit_id IS NOT NULL THEN
    SELECT unit_number INTO v_unit_num FROM public.units WHERE id = v_unit_id;
  END IF;
  -- Create contacts/tenants for any staged people and add to contacts list
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
      CASE
        WHEN (coalesce(v_person->>'same_as_unit','false') = 'true'
              OR (coalesce(v_person->>'addr1','') = '' AND coalesce(v_person->>'city','')='' AND coalesce(v_person->>'state','')='' AND coalesce(v_person->>'postal','')='' AND coalesce(v_person->>'country','')=''))
        THEN v_addr1
        ELSE nullif(v_person->>'addr1','')
      END,
      CASE
        WHEN (coalesce(v_person->>'same_as_unit','false') = 'true'
              OR (coalesce(v_person->>'addr1','') = '' AND coalesce(v_person->>'city','')='' AND coalesce(v_person->>'state','')='' AND coalesce(v_person->>'postal','')='' AND coalesce(v_person->>'country','')=''))
        THEN coalesce(v_addr2, CASE WHEN v_unit_num IS NOT NULL THEN 'Unit ' || v_unit_num ELSE NULL END)
        ELSE nullif(v_person->>'addr2','')
      END,
      CASE
        WHEN (coalesce(v_person->>'same_as_unit','false') = 'true'
              OR (coalesce(v_person->>'addr1','') = '' AND coalesce(v_person->>'city','')='' AND coalesce(v_person->>'state','')='' AND coalesce(v_person->>'postal','')='' AND coalesce(v_person->>'country','')=''))
        THEN v_city ELSE nullif(v_person->>'city','') END,
      CASE
        WHEN (coalesce(v_person->>'same_as_unit','false') = 'true'
              OR (coalesce(v_person->>'addr1','') = '' AND coalesce(v_person->>'city','')='' AND coalesce(v_person->>'state','')='' AND coalesce(v_person->>'postal','')='' AND coalesce(v_person->>'country','')=''))
        THEN v_state ELSE nullif(v_person->>'state','') END,
      CASE
        WHEN (coalesce(v_person->>'same_as_unit','false') = 'true'
              OR (coalesce(v_person->>'addr1','') = '' AND coalesce(v_person->>'city','')='' AND coalesce(v_person->>'state','')='' AND coalesce(v_person->>'postal','')='' AND coalesce(v_person->>'country','')=''))
        THEN v_postal ELSE nullif(v_person->>'postal','') END,
      CASE
        WHEN (coalesce(v_person->>'same_as_unit','false') = 'true'
              OR (coalesce(v_person->>'addr1','') = '' AND coalesce(v_person->>'city','')='' AND coalesce(v_person->>'state','')='' AND coalesce(v_person->>'postal','')='' AND coalesce(v_person->>'country','')=''))
        THEN v_country ELSE nullif(v_person->>'country','') END,
      nullif(v_person->>'alt_addr1',''),
      nullif(v_person->>'alt_addr2',''),
      nullif(v_person->>'alt_city',''),
      nullif(v_person->>'alt_state',''),
      nullif(v_person->>'alt_postal',''),
      nullif(v_person->>'alt_country','')
    ) RETURNING id INTO v_contact_id;

    INSERT INTO public.tenants (contact_id, created_at, updated_at)
    VALUES (v_contact_id, v_now, v_now)
    RETURNING id INTO v_tenant_id;

    v_contacts := v_contacts || jsonb_build_array(jsonb_build_object(
      'tenant_id', v_tenant_id,
      'role', coalesce(v_person->>'role','Tenant'),
      'is_rent_responsible', (coalesce(v_person->>'role','Tenant') = 'Tenant')
    ));
  END LOOP;

  -- Overwrite contacts in payload with the augmented list
  payload := jsonb_set(payload, '{contacts}', v_contacts, true);

  -- Delegate to existing aggregate creator (single TX inside)
  RETURN public.fn_create_lease_aggregate(payload);
END;
$$;
