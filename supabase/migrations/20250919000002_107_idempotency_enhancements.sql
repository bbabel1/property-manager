-- Migration: Enhance idempotency for critical functions
-- Description: Adds idempotency checks and error handling to prevent duplicate operations
-- Date: 2025-09-19
-- Enhance fn_create_lease_aggregate with better idempotency
CREATE OR REPLACE FUNCTION public.fn_create_lease_aggregate(payload jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_lease_id bigint;
v_existing_lease_id bigint;
v_unit_id uuid := nullif(payload->'lease'->>'unit_id', '')::uuid;
v_property_id uuid := nullif(payload->'lease'->>'property_id', '')::uuid;
BEGIN -- Check for existing lease on this unit
IF v_unit_id IS NOT NULL THEN
SELECT id INTO v_existing_lease_id
FROM public.lease
WHERE unit_id = v_unit_id
    AND status IN ('Active', 'Pending')
LIMIT 1;
IF v_existing_lease_id IS NOT NULL THEN RETURN jsonb_build_object(
    'success',
    false,
    'error',
    'Unit already has an active or pending lease',
    'existing_lease_id',
    v_existing_lease_id
);
END IF;
END IF;
-- Create lease with bigint ID
INSERT INTO public.lease (
        property_id,
        unit_id,
        lease_from_date,
        lease_to_date,
        status,
        comment,
        created_at,
        updated_at
    )
VALUES (
        v_property_id,
        v_unit_id,
        (payload->'lease'->>'lease_from_date')::timestamp,
        (payload->'lease'->>'lease_to_date')::timestamp,
        coalesce(payload->'lease'->>'status', 'Active'),
        payload->'lease'->>'comment',
        now(),
        now()
    )
RETURNING id INTO v_lease_id;
RETURN jsonb_build_object('success', true, 'lease_id', v_lease_id);
END;
$$;