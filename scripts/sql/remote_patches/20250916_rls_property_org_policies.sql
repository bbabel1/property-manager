-- Org-scoped RLS using property -> org join

-- Ensure RLS enabled
ALTER TABLE public.lease ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_lines ENABLE ROW LEVEL SECURITY;

-- Helper predicate reused in policies (inline exists queries)

-- leases
DROP POLICY IF EXISTS lease_select_org ON public.lease;
CREATE POLICY lease_select_org ON public.lease
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE p.id = lease.property_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS lease_insert_org ON public.lease;
CREATE POLICY lease_insert_org ON public.lease
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE p.id = lease.property_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS lease_update_org ON public.lease;
CREATE POLICY lease_update_org ON public.lease
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE p.id = lease.property_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS lease_delete_org ON public.lease;
CREATE POLICY lease_delete_org ON public.lease
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE p.id = lease.property_id AND m.user_id = auth.uid()
    )
  );

-- lease_contacts
DROP POLICY IF EXISTS lease_contacts_select_org ON public.lease_contacts;
CREATE POLICY lease_contacts_select_org ON public.lease_contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = lease_contacts.lease_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS lease_contacts_insert_org ON public.lease_contacts;
CREATE POLICY lease_contacts_insert_org ON public.lease_contacts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = lease_contacts.lease_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS lease_contacts_update_org ON public.lease_contacts;
CREATE POLICY lease_contacts_update_org ON public.lease_contacts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = lease_contacts.lease_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS lease_contacts_delete_org ON public.lease_contacts;
CREATE POLICY lease_contacts_delete_org ON public.lease_contacts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = lease_contacts.lease_id AND m.user_id = auth.uid()
    )
  );

-- rent_schedules
DROP POLICY IF EXISTS rent_schedules_select_org ON public.rent_schedules;
CREATE POLICY rent_schedules_select_org ON public.rent_schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = rent_schedules.lease_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS rent_schedules_insert_org ON public.rent_schedules;
CREATE POLICY rent_schedules_insert_org ON public.rent_schedules
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = rent_schedules.lease_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS rent_schedules_update_org ON public.rent_schedules;
CREATE POLICY rent_schedules_update_org ON public.rent_schedules
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = rent_schedules.lease_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS rent_schedules_delete_org ON public.rent_schedules;
CREATE POLICY rent_schedules_delete_org ON public.rent_schedules
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = rent_schedules.lease_id AND m.user_id = auth.uid()
    )
  );

-- recurring_transactions
DROP POLICY IF EXISTS recurring_transactions_select_org ON public.recurring_transactions;
CREATE POLICY recurring_transactions_select_org ON public.recurring_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = recurring_transactions.lease_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS recurring_transactions_insert_org ON public.recurring_transactions;
CREATE POLICY recurring_transactions_insert_org ON public.recurring_transactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = recurring_transactions.lease_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS recurring_transactions_update_org ON public.recurring_transactions;
CREATE POLICY recurring_transactions_update_org ON public.recurring_transactions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = recurring_transactions.lease_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS recurring_transactions_delete_org ON public.recurring_transactions;
CREATE POLICY recurring_transactions_delete_org ON public.recurring_transactions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = recurring_transactions.lease_id AND m.user_id = auth.uid()
    )
  );

-- lease_documents
DROP POLICY IF EXISTS lease_documents_select_org ON public.lease_documents;
CREATE POLICY lease_documents_select_org ON public.lease_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = lease_documents.lease_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS lease_documents_insert_org ON public.lease_documents;
CREATE POLICY lease_documents_insert_org ON public.lease_documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = lease_documents.lease_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS lease_documents_update_org ON public.lease_documents;
CREATE POLICY lease_documents_update_org ON public.lease_documents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = lease_documents.lease_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS lease_documents_delete_org ON public.lease_documents;
CREATE POLICY lease_documents_delete_org ON public.lease_documents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = lease_documents.lease_id AND m.user_id = auth.uid()
    )
  );

-- transactions: allow if linked lease belongs to member org
DROP POLICY IF EXISTS transactions_select_org ON public.transactions;
CREATE POLICY transactions_select_org ON public.transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lease l JOIN public.properties p ON p.id = l.property_id JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = transactions.lease_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS transactions_insert_org ON public.transactions;
CREATE POLICY transactions_insert_org ON public.transactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lease l JOIN public.properties p ON p.id = l.property_id JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = transactions.lease_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS transactions_update_org ON public.transactions;
CREATE POLICY transactions_update_org ON public.transactions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.lease l JOIN public.properties p ON p.id = l.property_id JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = transactions.lease_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS transactions_delete_org ON public.transactions;
CREATE POLICY transactions_delete_org ON public.transactions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.lease l JOIN public.properties p ON p.id = l.property_id JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = transactions.lease_id AND m.user_id = auth.uid()
    )
  );

-- transaction_lines mirrors transactions
DROP POLICY IF EXISTS transaction_lines_select_org ON public.transaction_lines;
CREATE POLICY transaction_lines_select_org ON public.transaction_lines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.transactions t WHERE t.id = transaction_lines.transaction_id
    )
  );

DROP POLICY IF EXISTS transaction_lines_write_org ON public.transaction_lines;
CREATE POLICY transaction_lines_write_org ON public.transaction_lines
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.transactions t WHERE t.id = transaction_lines.transaction_id
    )
  );
-- updates/deletes guarded by same
DROP POLICY IF EXISTS transaction_lines_update_org ON public.transaction_lines;
CREATE POLICY transaction_lines_update_org ON public.transaction_lines
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.transactions t WHERE t.id = transaction_lines.transaction_id
    )
  );
DROP POLICY IF EXISTS transaction_lines_delete_org ON public.transaction_lines;
CREATE POLICY transaction_lines_delete_org ON public.transaction_lines
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.transactions t WHERE t.id = transaction_lines.transaction_id
    )
  );
