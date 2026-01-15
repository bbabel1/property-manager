-- Ensure v_dashboard_kpis runs as security invoker (not definer) to satisfy Supabase lint.
BEGIN;

-- Switch view to security invoker so queries use the caller's permissions/RLS.
ALTER VIEW IF EXISTS public.v_dashboard_kpis
  SET (security_invoker = true);

-- Preserve access for application role.
GRANT SELECT ON public.v_dashboard_kpis TO authenticated;

COMMIT;
