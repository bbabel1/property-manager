-- RLS: Org-scoped policies for leases domain

-- Helper note: policies rely on org_memberships(user_id, org_id)

-- Ensure RLS enabled
ALTER TABLE public.lease ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_lines ENABLE ROW LEVEL SECURITY;

-- Drop permissive policies if any (best-effort)
DO $$ BEGIN
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='lease' AND policyname='lease_read_all';
  IF FOUND THEN EXECUTE 'drop policy "lease_read_all" on public.lease'; END IF;
EXCEPTION WHEN others THEN NULL; END $$;

-- Leases (read/write limited to member org)
DROP POLICY IF EXISTS lease_read_org ON public.lease;
CREATE POLICY lease_read_org ON public.lease
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE p.id = lease.property_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS lease_write_org ON public.lease;
CREATE POLICY lease_write_org ON public.lease
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

-- Lease contacts — scope by lease.org_id
DROP POLICY IF EXISTS lease_contacts_select_org ON public.lease_contacts;
CREATE POLICY lease_contacts_select_org ON public.lease_contacts
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = lease_contacts.lease_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS lease_contacts_write_org ON public.lease_contacts;
CREATE POLICY lease_contacts_write_org ON public.lease_contacts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = lease_contacts.lease_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS lease_contacts_update_org ON public.lease_contacts;
CREATE POLICY lease_contacts_update_org ON public.lease_contacts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = lease_contacts.lease_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS lease_contacts_delete_org ON public.lease_contacts;
CREATE POLICY lease_contacts_delete_org ON public.lease_contacts
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = lease_contacts.lease_id AND m.user_id = auth.uid()
    )
  );

-- Rent schedules — scope by lease.org_id
DROP POLICY IF EXISTS rent_schedules_select_org ON public.rent_schedules;
CREATE POLICY rent_schedules_select_org ON public.rent_schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = rent_schedules.lease_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS rent_schedules_write_org ON public.rent_schedules;
CREATE POLICY rent_schedules_write_org ON public.rent_schedules
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = rent_schedules.lease_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS rent_schedules_update_org ON public.rent_schedules;
CREATE POLICY rent_schedules_update_org ON public.rent_schedules
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = rent_schedules.lease_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS rent_schedules_delete_org ON public.rent_schedules;
CREATE POLICY rent_schedules_delete_org ON public.rent_schedules
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM public.lease l
      JOIN public.properties p ON p.id = l.property_id
      JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = rent_schedules.lease_id AND m.user_id = auth.uid()
    )
  );

-- Recurring transactions — scope by lease.org_id
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

-- Lease documents — scope by lease.org_id
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

-- Transactions — scope by lease.org_id
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

-- Transaction lines — scope by lease.org_id
DO $$ BEGIN
  PERFORM 1 FROM pg_policies WHERE schemaname='public' AND tablename='transaction_lines' AND policyname='Allow all operations on journal_entries';
  IF FOUND THEN EXECUTE 'drop policy "Allow all operations on journal_entries" on public.transaction_lines'; END IF;
EXCEPTION WHEN others THEN NULL; END $$;

DROP POLICY IF EXISTS transaction_lines_select_org ON public.transaction_lines;
CREATE POLICY transaction_lines_select_org ON public.transaction_lines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lease l JOIN public.properties p ON p.id = l.property_id JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = transaction_lines.lease_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS transaction_lines_insert_org ON public.transaction_lines;
CREATE POLICY transaction_lines_insert_org ON public.transaction_lines
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lease l JOIN public.properties p ON p.id = l.property_id JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = transaction_lines.lease_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS transaction_lines_update_org ON public.transaction_lines;
CREATE POLICY transaction_lines_update_org ON public.transaction_lines
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.lease l JOIN public.properties p ON p.id = l.property_id JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = transaction_lines.lease_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS transaction_lines_delete_org ON public.transaction_lines;
CREATE POLICY transaction_lines_delete_org ON public.transaction_lines
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.lease l JOIN public.properties p ON p.id = l.property_id JOIN public.org_memberships m ON m.org_id = p.org_id
      WHERE l.id = transaction_lines.lease_id AND m.user_id = auth.uid()
    )
  );

-- Storage bucket 'lease-documents' is private; add org-scoped read/write using path convention: lease-documents/org/{org_id}/...
DO $$ BEGIN
  -- READ policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='lease_docs_storage_read_org'
  ) THEN
    EXECUTE 'create policy "lease_docs_storage_read_org" on storage.objects '
         || 'for select using ( '
         || '  bucket_id = ''lease-documents'' '
         || '  and exists (select 1 from public.org_memberships m '
         || '              where m.user_id = auth.uid() and m.org_id::text = split_part(storage.objects.name,''/'',2)) '
         || ')';
  END IF;
  -- WRITE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='lease_docs_storage_write_org'
  ) THEN
    EXECUTE 'create policy "lease_docs_storage_write_org" on storage.objects '
         || 'for insert with check ( '
         || '  bucket_id = ''lease-documents'' '
         || '  and exists (select 1 from public.org_memberships m '
         || '              where m.user_id = auth.uid() and m.org_id::text = split_part(storage.objects.name,''/'',2)) '
         || ')';
  END IF;
END $$;
