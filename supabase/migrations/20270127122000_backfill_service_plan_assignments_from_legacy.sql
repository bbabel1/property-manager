-- Backfill Service Plans v2 assignments from legacy properties/units service/fee columns.
-- This migration is designed to be safe to run once and to be resilient when legacy columns are absent.

BEGIN;

-- Ensure canonical plan templates exist per org (the API seeds these only when an org has zero plans).
INSERT INTO public.service_plans (org_id, name, amount_type, percent_basis, is_active)
SELECT org.id, template.name, 'flat', 'lease_rent_amount', true
FROM public.organizations org
CROSS JOIN (
  VALUES ('Full'), ('Basic'), ('A-la-carte'), ('Custom')
) AS template(name)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.service_plans sp
  WHERE sp.org_id = org.id AND lower(sp.name) = lower(template.name)
);

DO $$
BEGIN
  -- Only attempt legacy backfill when the legacy columns exist.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'properties' AND column_name = 'service_plan'
  ) THEN
    -- If older backfills created a synthetic "Management Fee" plan, repoint active assignments to the
    -- real plan selected on the property/unit whenever possible.
    EXECUTE $sql$
      WITH mgmt_fee_plans AS (
        SELECT id, org_id
        FROM public.service_plans
        WHERE lower(name) = 'management fee'
      ),
      target_plans AS (
        SELECT org_id, lower(name) AS plan_name, id AS plan_id
        FROM public.service_plans
      )
      UPDATE public.service_plan_assignments a
      SET plan_id = tp.plan_id,
          updated_at = now()
      FROM public.properties p
      JOIN mgmt_fee_plans mfp ON mfp.org_id = p.org_id
      JOIN target_plans tp ON tp.org_id = p.org_id AND tp.plan_name = lower(p.service_plan::text)
      WHERE a.property_id = p.id
        AND a.unit_id IS NULL
        AND a.effective_end IS NULL
        AND a.plan_id = mfp.id
        AND p.service_plan IS NOT NULL;
    $sql$;

    EXECUTE $sql$
      WITH mgmt_fee_plans AS (
        SELECT id, org_id
        FROM public.service_plans
        WHERE lower(name) = 'management fee'
      ),
      target_plans AS (
        SELECT org_id, lower(name) AS plan_name, id AS plan_id
        FROM public.service_plans
      )
      UPDATE public.service_plan_assignments a
      SET plan_id = tp.plan_id,
          updated_at = now()
      FROM public.units u
      JOIN public.properties p ON p.id = u.property_id
      JOIN mgmt_fee_plans mfp ON mfp.org_id = p.org_id
      JOIN target_plans tp
        ON tp.org_id = p.org_id AND tp.plan_name = lower(coalesce(u.service_plan, p.service_plan)::text)
      WHERE a.unit_id = u.id
        AND a.effective_end IS NULL
        AND a.plan_id = mfp.id
        AND coalesce(u.service_plan, p.service_plan) IS NOT NULL;
    $sql$;

    -- Backfill property-level assignments from properties.* legacy fields.
    EXECUTE $sql$
      INSERT INTO public.service_plan_assignments (
        org_id,
        property_id,
        unit_id,
        plan_id,
        plan_fee_amount,
        plan_fee_percent,
        plan_fee_frequency,
        effective_start,
        is_active
      )
      SELECT
        p.org_id,
        p.id,
        NULL,
        sp.id,
        CASE
          WHEN p.fee_type = 'Flat Rate' OR (p.fee_dollar_amount IS NOT NULL AND p.fee_dollar_amount > 0)
            THEN p.fee_dollar_amount
          ELSE NULL
        END AS plan_fee_amount,
        CASE
          WHEN p.fee_type = 'Percentage' OR (p.fee_percentage IS NOT NULL AND p.fee_percentage > 0)
            THEN p.fee_percentage
          ELSE 0
        END AS plan_fee_percent,
        COALESCE(p.billing_frequency, 'Monthly') AS plan_fee_frequency,
        COALESCE(p.created_at, now()) AS effective_start,
        true
      FROM public.properties p
      JOIN public.service_plans sp
        ON sp.org_id = p.org_id AND lower(sp.name) = lower(p.service_plan::text)
      WHERE COALESCE(p.service_assignment, 'Property Level') = 'Property Level'
        AND p.service_plan IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.service_plan_assignments a
          WHERE a.org_id = p.org_id
            AND a.property_id = p.id
            AND a.unit_id IS NULL
            AND a.effective_end IS NULL
        );
    $sql$;

    -- Backfill unit-level assignments from units.* legacy fields, falling back to the property values.
    EXECUTE $sql$
      WITH unit_sources AS (
        SELECT
          u.id AS unit_id,
          u.property_id,
          p.org_id,
          COALESCE(u.service_plan, p.service_plan) AS legacy_plan,
          COALESCE(u.fee_type, p.fee_type) AS legacy_fee_type,
          COALESCE(u.fee_dollar_amount, p.fee_dollar_amount) AS legacy_fee_amount,
          COALESCE(u.fee_percentage, u.fee_percent, p.fee_percentage) AS legacy_fee_percent,
          COALESCE(u.billing_frequency, p.billing_frequency, 'Monthly') AS legacy_frequency,
          COALESCE(u.created_at, p.created_at, now()) AS effective_start
        FROM public.units u
        JOIN public.properties p ON p.id = u.property_id
        WHERE COALESCE(p.service_assignment, 'Property Level') = 'Unit Level'
          AND COALESCE(u.service_plan, p.service_plan) IS NOT NULL
      )
      INSERT INTO public.service_plan_assignments (
        org_id,
        property_id,
        unit_id,
        plan_id,
        plan_fee_amount,
        plan_fee_percent,
        plan_fee_frequency,
        effective_start,
        is_active
      )
      SELECT
        src.org_id,
        src.property_id,
        src.unit_id,
        sp.id,
        CASE
          WHEN src.legacy_fee_type = 'Flat Rate' OR (src.legacy_fee_amount IS NOT NULL AND src.legacy_fee_amount > 0)
            THEN src.legacy_fee_amount
          ELSE NULL
        END AS plan_fee_amount,
        CASE
          WHEN src.legacy_fee_type = 'Percentage' OR (src.legacy_fee_percent IS NOT NULL AND src.legacy_fee_percent > 0)
            THEN src.legacy_fee_percent
          ELSE 0
        END AS plan_fee_percent,
        src.legacy_frequency AS plan_fee_frequency,
        src.effective_start,
        true
      FROM unit_sources src
      JOIN public.service_plans sp
        ON sp.org_id = src.org_id AND lower(sp.name) = lower(src.legacy_plan::text)
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.service_plan_assignments a
        WHERE a.org_id = src.org_id
          AND a.unit_id = src.unit_id
          AND a.effective_end IS NULL
      );
    $sql$;

    -- Backfill A-la-carte selected services for property-level assignments based on properties.active_services.
    EXECUTE $sql$
      WITH plan_by_org AS (
        SELECT org_id, id AS plan_id
        FROM public.service_plans
        WHERE lower(name) = 'a-la-carte'
      ),
      scopes AS (
        SELECT
          a.id AS assignment_id,
          p.org_id,
          p.active_services
        FROM public.properties p
        JOIN plan_by_org pl ON pl.org_id = p.org_id
        JOIN public.service_plan_assignments a
          ON a.org_id = p.org_id AND a.property_id = p.id AND a.unit_id IS NULL AND a.effective_end IS NULL
        WHERE COALESCE(p.service_assignment, 'Property Level') = 'Property Level'
          AND lower(p.service_plan::text) = 'a-la-carte'
          AND p.active_services IS NOT NULL
      ),
      desired AS (
        SELECT
          s.assignment_id,
          so.id AS offering_id
        FROM scopes s
        JOIN LATERAL unnest(s.active_services) AS svc(name) ON true
        JOIN public.service_offerings so ON lower(so.name) = lower(svc.name::text)
      )
      INSERT INTO public.service_offering_assignments (
        assignment_id,
        offering_id,
        is_active,
        override_amount,
        override_frequency,
        amount,
        frequency
      )
      SELECT
        d.assignment_id,
        d.offering_id,
        true,
        false,
        false,
        NULL,
        NULL
      FROM desired d
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.service_offering_assignments existing
        WHERE existing.assignment_id = d.assignment_id AND existing.offering_id = d.offering_id
      );
    $sql$;

    -- Backfill A-la-carte selected services for unit-level assignments based on units.active_services (falling back to property.active_services).
    EXECUTE $sql$
      WITH plan_by_org AS (
        SELECT org_id, id AS plan_id
        FROM public.service_plans
        WHERE lower(name) = 'a-la-carte'
      ),
      scopes AS (
        SELECT
          a.id AS assignment_id,
          p.org_id,
          COALESCE(u.active_services, p.active_services) AS active_services
        FROM public.units u
        JOIN public.properties p ON p.id = u.property_id
        JOIN plan_by_org pl ON pl.org_id = p.org_id
        JOIN public.service_plan_assignments a
          ON a.org_id = p.org_id AND a.unit_id = u.id AND a.effective_end IS NULL
        WHERE COALESCE(p.service_assignment, 'Property Level') = 'Unit Level'
          AND lower(COALESCE(u.service_plan, p.service_plan)::text) = 'a-la-carte'
          AND COALESCE(u.active_services, p.active_services) IS NOT NULL
      ),
      desired AS (
        SELECT
          s.assignment_id,
          so.id AS offering_id
        FROM scopes s
        JOIN LATERAL unnest(s.active_services) AS svc(name) ON true
        JOIN public.service_offerings so ON lower(so.name) = lower(svc.name::text)
      )
      INSERT INTO public.service_offering_assignments (
        assignment_id,
        offering_id,
        is_active,
        override_amount,
        override_frequency,
        amount,
        frequency
      )
      SELECT
        d.assignment_id,
        d.offering_id,
        true,
        false,
        false,
        NULL,
        NULL
      FROM desired d
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.service_offering_assignments existing
        WHERE existing.assignment_id = d.assignment_id AND existing.offering_id = d.offering_id
      );
    $sql$;
  END IF;
END $$;

COMMIT;

