-- Enable RLS and add org-scoped policies for transaction_payment_transactions
-- Mirrors transactions table policies to ensure consistent access control
-- Uses helper functions (is_org_member, is_org_admin_or_manager) for role checks

-- Enable RLS
ALTER TABLE public.transaction_payment_transactions ENABLE ROW LEVEL SECURITY;

-- Read policy: org members can read splits for transactions in their org
DROP POLICY IF EXISTS "transaction_payment_transactions_org_read" ON public.transaction_payment_transactions;
CREATE POLICY "transaction_payment_transactions_org_read" 
ON public.transaction_payment_transactions
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.transactions t
    WHERE t.id = transaction_payment_transactions.transaction_id
      AND public.is_org_member((SELECT auth.uid()), t.org_id)
  )
);

-- Write policy: org admins/managers can insert splits for transactions in their org
DROP POLICY IF EXISTS "transaction_payment_transactions_org_write" ON public.transaction_payment_transactions;
CREATE POLICY "transaction_payment_transactions_org_write" 
ON public.transaction_payment_transactions
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.transactions t
    WHERE t.id = transaction_payment_transactions.transaction_id
      AND public.is_org_admin_or_manager((SELECT auth.uid()), t.org_id)
  )
);

-- Update policy: org admins/managers can update splits for transactions in their org
DROP POLICY IF EXISTS "transaction_payment_transactions_org_update" ON public.transaction_payment_transactions;
CREATE POLICY "transaction_payment_transactions_org_update" 
ON public.transaction_payment_transactions
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.transactions t
    WHERE t.id = transaction_payment_transactions.transaction_id
      AND public.is_org_admin_or_manager((SELECT auth.uid()), t.org_id)
  )
);

-- Delete policy: org admins/managers can delete splits for transactions in their org
DROP POLICY IF EXISTS "transaction_payment_transactions_org_delete" ON public.transaction_payment_transactions;
CREATE POLICY "transaction_payment_transactions_org_delete" 
ON public.transaction_payment_transactions
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 
    FROM public.transactions t
    WHERE t.id = transaction_payment_transactions.transaction_id
      AND public.is_org_admin_or_manager((SELECT auth.uid()), t.org_id)
  )
);

COMMENT ON TABLE public.transaction_payment_transactions IS 'PaymentTransactions inside Buildium DepositDetails; tracks splits and accounting entities. Access scoped by parent transaction org membership.';

