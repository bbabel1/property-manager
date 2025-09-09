-- Add direct property reference on appliances
ALTER TABLE public.appliances
  ADD COLUMN IF NOT EXISTS property_id uuid;

ALTER TABLE public.appliances
  ADD CONSTRAINT appliances_property_id_fkey
  FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS appliances_property_id_idx
  ON public.appliances(property_id);

COMMENT ON COLUMN public.appliances.property_id IS 'Local property UUID (convenience link)';

