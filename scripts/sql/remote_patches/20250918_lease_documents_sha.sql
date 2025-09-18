-- Add sha256 to lease_documents and extend aggregate function to accept it

ALTER TABLE public.lease_documents
  ADD COLUMN IF NOT EXISTS sha256 text;

-- Update function to insert sha256 if provided
CREATE OR REPLACE FUNCTION public.fn_create_lease_aggregate(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_lease_id integer;
  v_now timestamptz := now();
BEGIN
  INSERT INTO public.lease (
    property_id, unit_id, lease_from_date, lease_to_date, lease_type,
    payment_due_day, security_deposit, rent_amount,
    prorated_first_month_rent, prorated_last_month_rent,
    renewal_offer_status, status, created_at, updated_at
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
    v_now, v_now
  ) RETURNING id INTO v_lease_id;

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

  INSERT INTO public.lease_documents (
    lease_id, name, category, storage_path, mime_type, size_bytes, sha256, is_private, created_at, updated_at
  )
  SELECT v_lease_id, d->>'name', NULLIF(d->>'category',''), d->>'storage_path', NULLIF(d->>'mime_type',''),
         NULLIF(d->>'size_bytes','')::int, NULLIF(d->>'sha256',''), COALESCE((d->>'is_private')::boolean, true), v_now, v_now
  FROM jsonb_array_elements(COALESCE(payload->'documents','[]'::jsonb)) AS d;

  RETURN jsonb_build_object('lease_id', v_lease_id);
EXCEPTION WHEN others THEN
  RAISE;
END;$$;

