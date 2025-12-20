-- Add extended pricing fields to service_plan_services to support richer plan defaults
ALTER TABLE public.service_plan_services
  ADD COLUMN IF NOT EXISTS billing_basis public.billing_basis_enum,
  ADD COLUMN IF NOT EXISTS rent_basis public.rent_basis_enum,
  ADD COLUMN IF NOT EXISTS markup_pct numeric(6,3),
  ADD COLUMN IF NOT EXISTS markup_pct_cap numeric(6,3),
  ADD COLUMN IF NOT EXISTS hourly_rate numeric(12,2),
  ADD COLUMN IF NOT EXISTS hourly_min_hours numeric(6,2),
  ADD COLUMN IF NOT EXISTS is_required boolean DEFAULT false;

-- Keep existing rows valid: set billing_basis from offering default when missing
UPDATE public.service_plan_services s
SET billing_basis = o.billing_basis
FROM public.service_offerings o
WHERE s.offering_id = o.id AND s.billing_basis IS NULL;
