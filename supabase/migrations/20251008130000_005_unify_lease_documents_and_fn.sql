-- Update lease aggregate functions to write to unified files + file_links

CREATE OR REPLACE FUNCTION public.fn_create_lease_aggregate(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_lease_id integer;
  v_now timestamptz := now();
  v_org uuid;
BEGIN
  -- Insert lease with org context
  INSERT INTO public.lease (
    property_id, unit_id, lease_from_date, lease_to_date, lease_type,
    payment_due_day, security_deposit, rent_amount,
    prorated_first_month_rent, prorated_last_month_rent,
    renewal_offer_status, status, org_id, created_at, updated_at
  ) VALUES (
    (payload->'lease'->>'property_id')::uuid,
    (payload->'lease'->>'unit_id')::uuid,
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
    NULLIF(payload->'lease'->>'org_id','')::uuid,
    v_now, v_now
  ) RETURNING id INTO v_lease_id;

  SELECT org_id INTO v_org FROM public.lease WHERE id = v_lease_id;

  -- Contacts
  INSERT INTO public.lease_contacts (
    lease_id, tenant_id, role, status, move_in_date, move_out_date, notice_given_date, is_rent_responsible, created_at, updated_at
  )
  SELECT v_lease_id,
         (c->>'tenant_id')::uuid,
         COALESCE(NULLIF(c->>'role',''),'Tenant')::public.lease_contact_role_enum,
         COALESCE(NULLIF(c->>'status',''),'Active')::public.lease_contact_status_enum,
         NULLIF(c->>'move_in_date','')::date,
         NULLIF(c->>'move_out_date','')::date,
         NULLIF(c->>'notice_given_date','')::date,
         COALESCE((c->>'is_rent_responsible')::boolean, false),
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

-- Drop legacy lease_documents and replace with view backed by unified files
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='lease_documents'
  ) THEN
    EXECUTE 'DROP TABLE public.lease_documents CASCADE';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.lease_documents AS
SELECT
  f.id::uuid AS id,
  fl.entity_int AS lease_id,
  f.file_name AS name,
  fl.category,
  f.storage_key AS storage_path,
  f.mime_type,
  f.size_bytes,
  f.sha256,
  f.is_private,
  f.created_at,
  f.updated_at
FROM public.file_links fl
JOIN public.files f ON f.id = fl.file_id
WHERE fl.entity_type = 'lease';

COMMENT ON VIEW public.lease_documents IS 'Compatibility view mapping unified files/file_links to legacy lease_documents shape';

