-- NSF / returned payment support and policies

CREATE TABLE IF NOT EXISTS public.returned_payment_policies (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  auto_create_nsf_fee boolean DEFAULT false,
  nsf_fee_amount numeric(14,2),
  nsf_fee_gl_account_id uuid REFERENCES public.gl_accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_returned_payment_policies_auto ON public.returned_payment_policies(auto_create_nsf_fee);

DROP TRIGGER IF EXISTS trg_returned_payment_policies_updated_at ON public.returned_payment_policies;
CREATE TRIGGER trg_returned_payment_policies_updated_at
  BEFORE UPDATE ON public.returned_payment_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.returned_payment_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS returned_payment_policies_org_read ON public.returned_payment_policies;
CREATE POLICY returned_payment_policies_org_read
ON public.returned_payment_policies
FOR SELECT
USING (public.is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS returned_payment_policies_org_insert ON public.returned_payment_policies;
CREATE POLICY returned_payment_policies_org_insert
ON public.returned_payment_policies
FOR INSERT
WITH CHECK (public.is_org_admin_or_manager(auth.uid(), org_id));

DROP POLICY IF EXISTS returned_payment_policies_org_update ON public.returned_payment_policies;
CREATE POLICY returned_payment_policies_org_update
ON public.returned_payment_policies
FOR UPDATE
USING (public.is_org_admin_or_manager(auth.uid(), org_id))
WITH CHECK (public.is_org_admin_or_manager(auth.uid(), org_id));

DROP POLICY IF EXISTS returned_payment_policies_org_delete ON public.returned_payment_policies;
CREATE POLICY returned_payment_policies_org_delete
ON public.returned_payment_policies
FOR DELETE
USING (public.is_org_admin_or_manager(auth.uid(), org_id));
