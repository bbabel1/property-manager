-- Migration: Dashboard KPI support (views, indexes, onboarding tables)
-- Purpose: Provide database primitives to power the dashboard so KPIs can be
--          computed from real data with org scoping and good performance.

BEGIN;

-- 1) Onboarding data model ---------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'onboarding_status_enum' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.onboarding_status_enum AS ENUM (
      'IN_PROGRESS', 'PENDING_APPROVAL', 'OVERDUE', 'COMPLETED'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'onboarding_task_status_enum' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.onboarding_task_status_enum AS ENUM (
      'PENDING', 'IN_PROGRESS', 'BLOCKED', 'DONE'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.property_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  status public.onboarding_status_enum NOT NULL DEFAULT 'IN_PROGRESS',
  progress smallint NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_stage text,
  assigned_staff_id integer REFERENCES public.staff(id),
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- updated_at trigger
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_property_onboarding_updated_at'
  ) THEN
    CREATE TRIGGER trg_property_onboarding_updated_at
    BEFORE UPDATE ON public.property_onboarding
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_property_onboarding_org ON public.property_onboarding(org_id);
CREATE INDEX IF NOT EXISTS idx_property_onboarding_property ON public.property_onboarding(property_id);
CREATE INDEX IF NOT EXISTS idx_property_onboarding_status ON public.property_onboarding(status);

CREATE TABLE IF NOT EXISTS public.property_onboarding_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  onboarding_id uuid NOT NULL REFERENCES public.property_onboarding(id) ON DELETE CASCADE,
  name text NOT NULL,
  status public.onboarding_task_status_enum NOT NULL DEFAULT 'PENDING',
  assigned_staff_id integer REFERENCES public.staff(id),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_property_onboarding_tasks_updated_at'
  ) THEN
    CREATE TRIGGER trg_property_onboarding_tasks_updated_at
    BEFORE UPDATE ON public.property_onboarding_tasks
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_property_onboarding_tasks_org ON public.property_onboarding_tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_property_onboarding_tasks_onboarding ON public.property_onboarding_tasks(onboarding_id);
CREATE INDEX IF NOT EXISTS idx_property_onboarding_tasks_status ON public.property_onboarding_tasks(status);

-- 2) Helpful indexes for KPI queries ----------------------------------------
-- Lease renewals windows
-- Ensure lease has org_id to support org-scoped KPIs (safe if missing)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'lease'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE public.lease ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT';
    EXCEPTION WHEN others THEN NULL; END;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lease_to_date_status_org ON public.lease(lease_to_date, status, org_id);
-- Work orders widgets
CREATE INDEX IF NOT EXISTS idx_work_orders_status_priority_org ON public.work_orders(status, priority, org_id);
-- Recent transactions + rent roll
CREATE INDEX IF NOT EXISTS idx_transactions_date_org ON public.transactions(date, org_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type_org ON public.transactions(transaction_type, org_id);

-- 3) Views for dashboard -----------------------------------------------------
-- 3a) Monthly rent roll per org for the current month
CREATE OR REPLACE VIEW public.v_rent_roll_current_month AS
WITH bounds AS (
  SELECT date_trunc('month', now())::date AS month_start,
         (date_trunc('month', now()) + interval '1 month - 1 day')::date AS month_end
), active_leases AS (
  SELECT l.org_id, l.id AS lease_id
  FROM public.lease l, bounds b
  WHERE l.status = 'Active'
    AND l.lease_from_date::date <= b.month_end
    AND (l.lease_to_date IS NULL OR l.lease_to_date::date >= b.month_start)
)
SELECT al.org_id,
       COALESCE(SUM(rs.total_amount), 0)::numeric AS rent_roll_amount
FROM active_leases al
JOIN public.rent_schedules rs ON rs.lease_id = al.lease_id
JOIN bounds b ON true
WHERE rs.rent_cycle = 'Monthly'
  AND rs.start_date::date <= b.month_end
  AND (rs.end_date IS NULL OR rs.end_date::date >= b.month_start)
GROUP BY al.org_id;

COMMENT ON VIEW public.v_rent_roll_current_month IS 'Aggregated monthly rent roll for current month by org.';

-- 3b) Previous month rent roll (for growth rate)
CREATE OR REPLACE VIEW public.v_rent_roll_previous_month AS
WITH bounds AS (
  SELECT (date_trunc('month', now()) - interval '1 month')::date AS month_start,
         (date_trunc('month', now()) - interval '1 day')::date AS month_end
), active_leases AS (
  SELECT l.org_id, l.id AS lease_id
  FROM public.lease l, bounds b
  WHERE l.status = 'Active'
    AND l.lease_from_date::date <= b.month_end
    AND (l.lease_to_date IS NULL OR l.lease_to_date::date >= b.month_start)
)
SELECT al.org_id,
       COALESCE(SUM(rs.total_amount), 0)::numeric AS rent_roll_amount
FROM active_leases al
JOIN public.rent_schedules rs ON rs.lease_id = al.lease_id
JOIN bounds b ON true
WHERE rs.rent_cycle = 'Monthly'
  AND rs.start_date::date <= b.month_end
  AND (rs.end_date IS NULL OR rs.end_date::date >= b.month_start)
GROUP BY al.org_id;

-- 3c) Lease renewals summary (windows from today)
CREATE OR REPLACE VIEW public.v_lease_renewals_summary AS
WITH base AS (
  SELECT org_id,
         CASE
           WHEN lease_to_date IS NULL THEN NULL
           ELSE (lease_to_date::date - current_date)
         END AS days_until,
         id
  FROM public.lease
  WHERE status = 'Active'
)
SELECT org_id,
       COUNT(*) FILTER (WHERE days_until IS NOT NULL AND days_until <= 30)    AS critical,
       COUNT(*) FILTER (WHERE days_until > 30  AND days_until <= 60)          AS upcoming,
       COUNT(*) FILTER (WHERE days_until > 60  AND days_until <= 90)          AS future
FROM base
GROUP BY org_id;

COMMENT ON VIEW public.v_lease_renewals_summary IS 'Counts of active leases expiring within 0–30/30–60/60–90 days by org.';

-- 3d) Work order summary counts
CREATE OR REPLACE VIEW public.v_work_order_summary AS
SELECT org_id,
       COUNT(*) FILTER (WHERE COALESCE(status,'') NOT IN ('Completed','Cancelled')) AS open_count,
       COUNT(*) FILTER (WHERE COALESCE(status,'') NOT IN ('Completed','Cancelled') AND lower(COALESCE(priority,'')) = 'urgent') AS urgent_count
FROM public.work_orders
GROUP BY org_id;

-- 3e) Recent transactions and active work orders (ranked for easy LIMIT)
CREATE OR REPLACE VIEW public.v_recent_transactions_ranked AS
SELECT t.*, 
       ROW_NUMBER() OVER (PARTITION BY t.org_id ORDER BY t.date DESC, t.created_at DESC) AS rn
FROM public.transactions t;

CREATE OR REPLACE VIEW public.v_active_work_orders_ranked AS
SELECT w.*, 
       ROW_NUMBER() OVER (PARTITION BY w.org_id ORDER BY COALESCE(w.scheduled_date, w.created_at) DESC) AS rn
FROM public.work_orders w
WHERE COALESCE(w.status,'') NOT IN ('Completed','Cancelled');

-- 3f) Property onboarding summary (counts by status per org)
CREATE OR REPLACE VIEW public.v_property_onboarding_summary AS
SELECT org_id,
       COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')     AS in_progress,
       COUNT(*) FILTER (WHERE status = 'PENDING_APPROVAL') AS pending_approval,
       COUNT(*) FILTER (WHERE status = 'OVERDUE')          AS overdue
FROM public.property_onboarding
GROUP BY org_id;

-- 3g) Top-level KPI rollup per org
CREATE OR REPLACE VIEW public.v_dashboard_kpis AS
WITH p AS (
  SELECT org_id,
         COUNT(*) AS total_properties,
         COALESCE(SUM(total_active_units), 0) AS total_units,
         COALESCE(SUM(total_occupied_units), 0) AS occupied_units,
         COALESCE(SUM(total_active_units - total_occupied_units), 0) AS available_units
  FROM public.properties
  GROUP BY org_id
), occ AS (
  SELECT org_id,
         CASE WHEN SUM(total_active_units) > 0
              THEN ROUND((SUM(total_occupied_units)::numeric / NULLIF(SUM(total_active_units),0)::numeric) * 100, 2)
              ELSE 0 END AS occupancy_rate
  FROM public.properties
  GROUP BY org_id
), leases AS (
  SELECT org_id, COUNT(*) FILTER (WHERE status = 'Active') AS active_leases
  FROM public.lease
  GROUP BY org_id
), rr_now AS (
  SELECT org_id, rent_roll_amount FROM public.v_rent_roll_current_month
), rr_prev AS (
  SELECT org_id, rent_roll_amount FROM public.v_rent_roll_previous_month
)
SELECT p.org_id,
       p.total_properties,
       p.total_units,
       p.occupied_units,
       p.available_units,
       occ.occupancy_rate,
       COALESCE(rr_now.rent_roll_amount, 0) AS monthly_rent_roll,
       l.active_leases,
       CASE WHEN COALESCE(rr_prev.rent_roll_amount, 0) = 0 THEN NULL
            ELSE ROUND(((COALESCE(rr_now.rent_roll_amount,0) - rr_prev.rent_roll_amount) / rr_prev.rent_roll_amount) * 100, 2)
       END AS growth_rate,
       w.open_count       AS open_work_orders,
       w.urgent_count     AS urgent_work_orders
FROM p
LEFT JOIN occ    ON occ.org_id = p.org_id
LEFT JOIN leases l ON l.org_id = p.org_id
LEFT JOIN rr_now ON rr_now.org_id = p.org_id
LEFT JOIN rr_prev ON rr_prev.org_id = p.org_id
LEFT JOIN public.v_work_order_summary w ON w.org_id = p.org_id;

COMMENT ON VIEW public.v_dashboard_kpis IS 'Single-row summary per org to drive top KPI cards.';

COMMIT;
