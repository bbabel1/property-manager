-- Remove per-service pricing structures in favor of plan-fee–only billing.
-- Drops service-level defaults/overrides tables and related mappings.

BEGIN;

DROP TABLE IF EXISTS public.service_assignment_services CASCADE;
DROP TABLE IF EXISTS public.service_plan_services CASCADE;
DROP TABLE IF EXISTS public.property_service_pricing CASCADE;
DROP TABLE IF EXISTS public.service_plan_default_pricing CASCADE;
DROP TABLE IF EXISTS public.service_plan_offerings CASCADE;

COMMIT;
