-- Migration: Enable RLS on recurring_transactions table
-- Purpose: Fix remaining RLS disabled table identified by Supabase linter
-- ============================================================================

-- Enable RLS on recurring_transactions
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;

-- recurring_transactions: scoped via lease_id -> property_id -> org_id
DROP POLICY IF EXISTS "recurring_transactions_tenant_select" ON public.recurring_transactions;
CREATE POLICY "recurring_transactions_tenant_select" ON public.recurring_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = recurring_transactions.lease_id
        AND m.user_id = auth.uid()
    )
    OR recurring_transactions.lease_id IS NULL  -- Allow access to records without lease_id (if any exist)
  );

DROP POLICY IF EXISTS "recurring_transactions_tenant_insert" ON public.recurring_transactions;
CREATE POLICY "recurring_transactions_tenant_insert" ON public.recurring_transactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = recurring_transactions.lease_id
        AND m.user_id = auth.uid()
    )
    OR recurring_transactions.lease_id IS NULL  -- Allow insert of records without lease_id (if needed)
  );

DROP POLICY IF EXISTS "recurring_transactions_tenant_update" ON public.recurring_transactions;
CREATE POLICY "recurring_transactions_tenant_update" ON public.recurring_transactions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = recurring_transactions.lease_id
        AND m.user_id = auth.uid()
    )
    OR recurring_transactions.lease_id IS NULL
  ) WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = recurring_transactions.lease_id
        AND m.user_id = auth.uid()
    )
    OR recurring_transactions.lease_id IS NULL
  );

DROP POLICY IF EXISTS "recurring_transactions_tenant_delete" ON public.recurring_transactions;
CREATE POLICY "recurring_transactions_tenant_delete" ON public.recurring_transactions
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = recurring_transactions.lease_id
        AND m.user_id = auth.uid()
    )
    OR recurring_transactions.lease_id IS NULL
  );

-- Force RLS to prevent owner bypass
ALTER TABLE public.recurring_transactions FORCE ROW LEVEL SECURITY;



