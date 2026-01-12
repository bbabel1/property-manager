-- Fix v_dashboard_kpis view after cleanup migration
-- The view v_dashboard_kpis was affected by cascading drops when v_work_order_summary
-- was removed. This migration recreates v_dashboard_kpis without the dependency
-- on the dropped v_work_order_summary view.
--
-- Also removes dependency on v_property_onboarding_summary which was dropped.

BEGIN;

-- Recreate v_dashboard_kpis without v_work_order_summary dependency
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
), work_orders AS (
  SELECT org_id,
         COUNT(*) FILTER (WHERE status NOT IN ('completed', 'cancelled')) AS open_count,
         COUNT(*) FILTER (WHERE status NOT IN ('completed', 'cancelled') 
                          AND priority IN ('urgent', 'high')) AS urgent_count
  FROM public.work_orders
  GROUP BY org_id
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
       COALESCE(w.open_count, 0) AS open_work_orders,
       COALESCE(w.urgent_count, 0) AS urgent_work_orders
FROM p
LEFT JOIN occ ON occ.org_id = p.org_id
LEFT JOIN leases l ON l.org_id = p.org_id
LEFT JOIN rr_now ON rr_now.org_id = p.org_id
LEFT JOIN rr_prev ON rr_prev.org_id = p.org_id
LEFT JOIN work_orders w ON w.org_id = p.org_id;

COMMENT ON VIEW public.v_dashboard_kpis IS 
  'Single-row summary per org to drive top KPI cards. Recreated after cleanup migration to remove dependency on dropped v_work_order_summary view.';

COMMIT;

