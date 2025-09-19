-- Create property_staff join table to associate properties with staff and roles
-- Aligns with usage in API routes and services

BEGIN;

CREATE TABLE IF NOT EXISTS public.property_staff (
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  staff_id bigint NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'PROPERTY_MANAGER',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_staff_pkey PRIMARY KEY (property_id, staff_id, role)
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_property_staff_property_id ON public.property_staff(property_id);
CREATE INDEX IF NOT EXISTS idx_property_staff_staff_id ON public.property_staff(staff_id);

-- Keep updated_at current on updates
CREATE TRIGGER trg_property_staff_updated_at
BEFORE UPDATE ON public.property_staff
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Security: enable RLS (service_role bypasses; add policies later as needed)
ALTER TABLE public.property_staff ENABLE ROW LEVEL SECURITY;

COMMIT;

