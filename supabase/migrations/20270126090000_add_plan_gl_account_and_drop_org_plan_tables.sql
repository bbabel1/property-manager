-- Add gl_account_id to service_plans and drop org-level plan GL/settings tables.

BEGIN;

-- Add nullable gl_account_id FK to service_plans for org-scoped plan GL mapping.
ALTER TABLE public.service_plans
  ADD COLUMN IF NOT EXISTS gl_account_id uuid NULL REFERENCES public.gl_accounts(id);

CREATE INDEX IF NOT EXISTS idx_service_plans_gl_account ON public.service_plans(gl_account_id);

-- Drop org-level plan settings table (plan fee config now lives on service_plans).
DROP TABLE IF EXISTS public.org_service_plan_settings CASCADE;

-- Drop org-level offering GL mapping table (unused after per-service removal).
DROP TABLE IF EXISTS public.org_service_offering_gl_accounts CASCADE;

COMMIT;
