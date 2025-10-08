-- Migration: Update lease aggregate function for bigint IDs and locking
-- Description: Updates fn_create_lease_aggregate to handle bigint IDs and add row locking
-- Date: 2025-09-19
-- Update function to handle bigint IDs and add locking
CREATE OR REPLACE FUNCTION public.fn_create_lease_aggregate(payload jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE v_lease_id bigint;
v_unit_id uuid := nullif(payload->'lease'->>'unit_id', '')::uuid;
v_property_id uuid := nullif(payload->'lease'->>'property_id', '')::uuid;
BEGIN -- Lock the unit row to prevent concurrent lease creation
IF v_unit_id IS NOT NULL THEN PERFORM 1
FROM public.units
WHERE id = v_unit_id FOR
UPDATE;
END IF;
-- Lock the property row as well
IF v_property_id IS NOT NULL THEN PERFORM 1
FROM public.properties
WHERE id = v_property_id FOR
UPDATE;
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