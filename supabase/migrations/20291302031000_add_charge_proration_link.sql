-- Add parent charge linkage for proration rollups (depends on charges table)

ALTER TABLE public.charges
  ADD COLUMN IF NOT EXISTS parent_charge_id uuid REFERENCES public.charges(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_charges_parent_charge_id ON public.charges(parent_charge_id);

COMMENT ON COLUMN public.charges.parent_charge_id IS 'Optional link to base charge for prorated child charges.';
