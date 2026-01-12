-- Org control accounts for AR, rent income, late fee income, and undeposited funds

CREATE TABLE IF NOT EXISTS public.org_control_accounts (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  ar_account_id uuid NOT NULL REFERENCES public.gl_accounts(id),
  undeposited_funds_account_id uuid REFERENCES public.gl_accounts(id),
  late_fee_income_account_id uuid REFERENCES public.gl_accounts(id),
  rent_income_account_id uuid NOT NULL REFERENCES public.gl_accounts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_control_accounts_ar ON public.org_control_accounts(ar_account_id);

DROP TRIGGER IF EXISTS trg_org_control_accounts_updated_at ON public.org_control_accounts;
CREATE TRIGGER trg_org_control_accounts_updated_at
  BEFORE UPDATE ON public.org_control_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.org_control_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_control_accounts_org_read ON public.org_control_accounts;
CREATE POLICY org_control_accounts_org_read
ON public.org_control_accounts
FOR SELECT
USING (public.is_org_member(auth.uid(), org_id));

DROP POLICY IF EXISTS org_control_accounts_org_insert ON public.org_control_accounts;
CREATE POLICY org_control_accounts_org_insert
ON public.org_control_accounts
FOR INSERT
WITH CHECK (public.is_org_admin_or_manager(auth.uid(), org_id));

DROP POLICY IF EXISTS org_control_accounts_org_update ON public.org_control_accounts;
CREATE POLICY org_control_accounts_org_update
ON public.org_control_accounts
FOR UPDATE
USING (public.is_org_admin_or_manager(auth.uid(), org_id))
WITH CHECK (public.is_org_admin_or_manager(auth.uid(), org_id));

DROP POLICY IF EXISTS org_control_accounts_org_delete ON public.org_control_accounts;
CREATE POLICY org_control_accounts_org_delete
ON public.org_control_accounts
FOR DELETE
USING (public.is_org_admin_or_manager(auth.uid(), org_id));

-- Transaction metadata column + indexes for charge/payment references
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Use btree indexes for text values extracted from JSONB
CREATE INDEX IF NOT EXISTS idx_transactions_metadata_charge_id
  ON public.transactions ((metadata->>'charge_id'))
  WHERE metadata->>'charge_id' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_metadata_payment_id
  ON public.transactions ((metadata->>'payment_id'))
  WHERE metadata->>'payment_id' IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_metadata_reversal_payment_id
  ON public.transactions ((metadata->>'reversal_of_payment_id'))
  WHERE metadata->>'reversal_of_payment_id' IS NOT NULL;
