-- Optimize properties list and add summary RPC
BEGIN;

-- Composite index to support org-scoped pagination and filtering
CREATE INDEX IF NOT EXISTS idx_properties_org_status_type_created_at
  ON public.properties (org_id, status, property_type, created_at DESC);

-- Consolidated property summary RPC used by the summary tab
CREATE OR REPLACE FUNCTION public.get_property_summary(p_property_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
WITH base AS (
  SELECT *
  FROM public.properties
  WHERE id = p_property_id
),
owners AS (
  SELECT
    COUNT(*) AS owner_count,
    jsonb_agg(
      jsonb_build_object(
        'id', poc.owner_id,
        'owner_id', poc.owner_id,
        'contact_id', poc.contact_id,
        'display_name', poc.display_name,
        'primary_email', poc.primary_email,
        'ownership_percentage', poc.ownership_percentage,
        'disbursement_percentage', poc.disbursement_percentage,
        'primary', poc.primary
      )
      ORDER BY poc.primary DESC, poc.updated_at DESC
    ) AS owners,
    (
      SELECT poc2.display_name
      FROM public.property_ownerships_cache poc2
      WHERE poc2.property_id = p_property_id
      ORDER BY poc2.primary DESC, poc2.updated_at DESC
      LIMIT 1
    ) AS primary_owner_name
  FROM public.property_ownerships_cache poc
  WHERE poc.property_id = p_property_id
),
unit_counts AS (
  SELECT
    COUNT(*) FILTER (WHERE status != 'Inactive') AS total_active_units,
    COUNT(*) FILTER (WHERE status = 'Occupied') AS occupied_units,
    COUNT(*) FILTER (WHERE status = 'Vacant') AS vacant_units
  FROM public.units
  WHERE property_id = p_property_id
),
manager AS (
  SELECT
    CONCAT_WS(' ', s.first_name, s.last_name) AS name,
    s.email,
    s.phone
  FROM public.property_staff ps
  JOIN public.staff s ON s.id = ps.staff_id
  WHERE ps.property_id = p_property_id
    AND ps.role = 'Property Manager'::public.staff_roles
  ORDER BY ps.created_at DESC
  LIMIT 1
),
accounts AS (
  SELECT
    op.id AS operating_id,
    op.name AS operating_name,
    op.bank_account_number AS operating_last4,
    dep.id AS deposit_id,
    dep.name AS deposit_name,
    dep.bank_account_number AS deposit_last4
  FROM base b
  LEFT JOIN public.gl_accounts op ON op.id = b.operating_bank_gl_account_id
  LEFT JOIN public.gl_accounts dep ON dep.id = b.deposit_trust_gl_account_id
)
SELECT jsonb_build_object(
  'property', to_jsonb(b.*),
  'owners', COALESCE(o.owners, '[]'::jsonb),
  'owner_count', COALESCE(o.owner_count, 0),
  'primary_owner_name', o.primary_owner_name,
  'units_summary', jsonb_build_object(
    'total', COALESCE(b.total_active_units, uc.total_active_units, 0),
    'occupied', COALESCE(b.total_occupied_units, uc.occupied_units, 0),
    'available',
      COALESCE(
        b.total_vacant_units,
        uc.vacant_units,
        GREATEST(
          COALESCE(b.total_active_units, uc.total_active_units, 0) - COALESCE(b.total_occupied_units, uc.occupied_units, 0),
          0
        )
      )
  ),
  'occupancy_rate',
    CASE
      WHEN COALESCE(b.total_active_units, uc.total_active_units, 0) > 0 THEN
        ROUND(
          (COALESCE(b.total_occupied_units, uc.occupied_units, 0)::numeric / COALESCE(b.total_active_units, uc.total_active_units, 0)) * 100,
          2
        )
      ELSE 0
    END,
  'property_manager_name', m.name,
  'property_manager_email', m.email,
  'property_manager_phone', m.phone,
  'operating_account',
    CASE
      WHEN a.operating_id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', a.operating_id,
        'name', a.operating_name,
        'last4', RIGHT(COALESCE(a.operating_last4::text, ''), 4)
      )
    END,
  'deposit_trust_account',
    CASE
      WHEN a.deposit_id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', a.deposit_id,
        'name', a.deposit_name,
        'last4', RIGHT(COALESCE(a.deposit_last4::text, ''), 4)
      )
    END
)
FROM base b
LEFT JOIN owners o ON TRUE
LEFT JOIN unit_counts uc ON TRUE
LEFT JOIN manager m ON TRUE
LEFT JOIN accounts a ON TRUE;
$$;

COMMIT;
