-- Fix Multiple Permissive Policies and Duplicate Index Performance Issues
-- This migration addresses overlapping policies and duplicate indexes that cause performance degradation

-- ============================================================================
-- PART 1: REMOVE DUPLICATE INDEXES
-- ============================================================================

-- bank_accounts: Remove duplicate indexes
DROP INDEX IF EXISTS public.idx_bank_accounts_buildium_id;  -- Duplicate of idx_bank_accounts_buildium_bank_id
DROP INDEX IF EXISTS public.idx_bank_accounts_name;         -- Duplicate of bank_accounts_name_idx

-- lease: Remove duplicate indexes  
DROP INDEX IF EXISTS public.idx_lease_buildium_id;          -- Duplicate of buildium_lease_id_unique
-- Note: Both lease_buildium_lease_id_unique and Lease_buildium_lease_id_key are constraints, not just indexes
-- DROP INDEX IF EXISTS public.lease_buildium_lease_id_unique; -- This is a constraint
-- DROP INDEX IF EXISTS public."Lease_buildium_lease_id_key";  -- This is also a constraint

-- units: Remove duplicate indexes
-- Note: units_buildium_unit_id_key is a constraint, not just an index
-- DROP INDEX IF EXISTS public.units_buildium_unit_id_key;     -- This is a constraint

-- transaction_lines: No obvious duplicates found, keeping all indexes

-- ============================================================================
-- PART 2: REMOVE OVERLAPPING PERMISSIVE POLICIES
-- ============================================================================

-- bank_accounts: Remove old permissive policies, keep org-scoped ones
DROP POLICY IF EXISTS "Allow authenticated users to delete bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Allow authenticated users to insert bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Allow authenticated users to update bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Allow authenticated users to view bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_read_in_org" ON public.bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_update_admins" ON public.bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_write_admins" ON public.bank_accounts;

-- owners: Remove old permissive policies, keep org-scoped ones
DROP POLICY IF EXISTS "owners_read_in_org" ON public.owners;
DROP POLICY IF EXISTS "owners_update_admins" ON public.owners;
DROP POLICY IF EXISTS "owners_write_admins" ON public.owners;

-- transactions: Remove old permissive policies, keep org-scoped ones
DROP POLICY IF EXISTS "Allow all operations on transactions" ON public.transactions;
DROP POLICY IF EXISTS "transactions_read_in_org" ON public.transactions;
DROP POLICY IF EXISTS "transactions_update_admins" ON public.transactions;
DROP POLICY IF EXISTS "transactions_write_admins" ON public.transactions;

-- work_orders: Remove old permissive policies, keep org-scoped ones
DROP POLICY IF EXISTS "work_orders_read_in_org" ON public.work_orders;
DROP POLICY IF EXISTS "work_orders_update_admins" ON public.work_orders;
DROP POLICY IF EXISTS "work_orders_write_admins" ON public.work_orders;

-- lease: Remove all permissive policies (no org-scoped ones exist yet)
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.lease;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.lease;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.lease;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.lease;

-- staff: Remove all permissive policies (no org-scoped ones exist yet)
DROP POLICY IF EXISTS "Enable delete access for authenticated users" ON public.staff;
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.staff;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.staff;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.staff;

-- tasks: Remove all permissive policies (no org-scoped ones exist yet)
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.tasks;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.tasks;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.tasks;

-- vendors: Remove all permissive policies (no org-scoped ones exist yet)
DROP POLICY IF EXISTS "Enable insert access for authenticated users" ON public.vendors;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.vendors;
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.vendors;

-- appliances: Remove permissive policy
DROP POLICY IF EXISTS "Allow all operations on appliances" ON public.appliances;

-- inspections: Remove permissive policy
DROP POLICY IF EXISTS "Allow all operations on inspections" ON public.inspections;

-- transaction_lines: Remove permissive policy
DROP POLICY IF EXISTS "Allow all operations on journal_entries" ON public.transaction_lines;

-- rent_schedules: Remove permissive policy
DROP POLICY IF EXISTS "Allow all operations on rent_schedules" ON public.rent_schedules;

-- ============================================================================
-- PART 3: ADD PROPER ORG-SCOPED POLICIES FOR TABLES THAT NEED THEM
-- ============================================================================

-- lease: Add org-scoped policies (assuming lease table has org_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'lease' 
    AND column_name = 'org_id'
  ) THEN
    EXECUTE 'CREATE POLICY "lease_org_read" ON public.lease
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = lease.org_id
        )
      )';
    
    EXECUTE 'CREATE POLICY "lease_org_write" ON public.lease
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = lease.org_id AND m.role IN (''org_admin'',''org_manager'',''platform_admin'')
        )
      )';
    
    EXECUTE 'CREATE POLICY "lease_org_update" ON public.lease
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = lease.org_id AND m.role IN (''org_admin'',''org_manager'',''platform_admin'')
        )
      )';
    
    EXECUTE 'CREATE POLICY "lease_org_delete" ON public.lease
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = lease.org_id AND m.role IN (''org_admin'',''org_manager'',''platform_admin'')
        )
      )';
  END IF;
END $$;

-- staff: Add org-scoped policies (assuming staff table has org_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'staff' 
    AND column_name = 'org_id'
  ) THEN
    EXECUTE 'CREATE POLICY "staff_org_read" ON public.staff
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = staff.org_id
        )
      )';
    
    EXECUTE 'CREATE POLICY "staff_org_write" ON public.staff
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = staff.org_id AND m.role IN (''org_admin'',''org_manager'',''platform_admin'')
        )
      )';
    
    EXECUTE 'CREATE POLICY "staff_org_update" ON public.staff
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = staff.org_id AND m.role IN (''org_admin'',''org_manager'',''platform_admin'')
        )
      )';
    
    EXECUTE 'CREATE POLICY "staff_org_delete" ON public.staff
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = staff.org_id AND m.role IN (''org_admin'',''org_manager'',''platform_admin'')
        )
      )';
  END IF;
END $$;

-- tasks: Add org-scoped policies (assuming tasks table has org_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tasks' 
    AND column_name = 'org_id'
  ) THEN
    EXECUTE 'CREATE POLICY "tasks_org_read" ON public.tasks
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = tasks.org_id
        )
      )';
    
    EXECUTE 'CREATE POLICY "tasks_org_write" ON public.tasks
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = tasks.org_id AND m.role IN (''org_admin'',''org_manager'',''platform_admin'')
        )
      )';
    
    EXECUTE 'CREATE POLICY "tasks_org_update" ON public.tasks
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = tasks.org_id AND m.role IN (''org_admin'',''org_manager'',''platform_admin'')
        )
      )';
  END IF;
END $$;

-- vendors: Add org-scoped policies (assuming vendors table has org_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'vendors' 
    AND column_name = 'org_id'
  ) THEN
    EXECUTE 'CREATE POLICY "vendors_org_read" ON public.vendors
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = vendors.org_id
        )
      )';
    
    EXECUTE 'CREATE POLICY "vendors_org_write" ON public.vendors
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = vendors.org_id AND m.role IN (''org_admin'',''org_manager'',''platform_admin'')
        )
      )';
    
    EXECUTE 'CREATE POLICY "vendors_org_update" ON public.vendors
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = vendors.org_id AND m.role IN (''org_admin'',''org_manager'',''platform_admin'')
        )
      )';
  END IF;
END $$;

-- appliances: Add org-scoped policies (assuming appliances table has org_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'appliances' 
    AND column_name = 'org_id'
  ) THEN
    EXECUTE 'CREATE POLICY "appliances_org_read" ON public.appliances
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = appliances.org_id
        )
      )';
    
    EXECUTE 'CREATE POLICY "appliances_org_write" ON public.appliances
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = appliances.org_id AND m.role IN (''org_admin'',''org_manager'',''platform_admin'')
        )
      )';
    
    EXECUTE 'CREATE POLICY "appliances_org_update" ON public.appliances
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = appliances.org_id AND m.role IN (''org_admin'',''org_manager'',''platform_admin'')
        )
      )';
    
    EXECUTE 'CREATE POLICY "appliances_org_delete" ON public.appliances
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = appliances.org_id AND m.role IN (''org_admin'',''org_manager'',''platform_admin'')
        )
      )';
  END IF;
END $$;

-- inspections: Add org-scoped policies (assuming inspections table has org_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'inspections' 
    AND column_name = 'org_id'
  ) THEN
    EXECUTE 'CREATE POLICY "inspections_org_read" ON public.inspections
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = inspections.org_id
        )
      )';
    
    EXECUTE 'CREATE POLICY "inspections_org_write" ON public.inspections
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = inspections.org_id AND m.role IN (''org_admin'',''org_manager'',''platform_admin'')
        )
      )';
    
    EXECUTE 'CREATE POLICY "inspections_org_update" ON public.inspections
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = inspections.org_id AND m.role IN (''org_admin'',''org_manager'',''platform_admin'')
        )
      )';
    
    EXECUTE 'CREATE POLICY "inspections_org_delete" ON public.inspections
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = inspections.org_id AND m.role IN (''org_admin'',''org_manager'',''platform_admin'')
        )
      )';
  END IF;
END $$;

-- transaction_lines: Add org-scoped policies (assuming transaction_lines table has org_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'transaction_lines' 
    AND column_name = 'org_id'
  ) THEN
    EXECUTE 'CREATE POLICY "transaction_lines_org_read" ON public.transaction_lines
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = transaction_lines.org_id
        )
      )';
    
    EXECUTE 'CREATE POLICY "transaction_lines_org_write" ON public.transaction_lines
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = transaction_lines.org_id AND m.role IN (''org_admin'',''org_manager'',''platform_admin'')
        )
      )';
    
    EXECUTE 'CREATE POLICY "transaction_lines_org_update" ON public.transaction_lines
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = transaction_lines.org_id AND m.role IN (''org_admin'',''org_manager'',''platform_admin'')
        )
      )';
    
    EXECUTE 'CREATE POLICY "transaction_lines_org_delete" ON public.transaction_lines
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = transaction_lines.org_id AND m.role IN (''org_admin'',''org_manager'',''platform_admin'')
        )
      )';
  END IF;
END $$;

-- rent_schedules: Add org-scoped policies (assuming rent_schedules table has org_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'rent_schedules' 
    AND column_name = 'org_id'
  ) THEN
    EXECUTE 'CREATE POLICY "rent_schedules_org_read" ON public.rent_schedules
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = rent_schedules.org_id
        )
      )';
    
    EXECUTE 'CREATE POLICY "rent_schedules_org_write" ON public.rent_schedules
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = rent_schedules.org_id AND m.role IN (''org_admin'',''org_manager'',''platform_admin'')
        )
      )';
    
    EXECUTE 'CREATE POLICY "rent_schedules_org_update" ON public.rent_schedules
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = rent_schedules.org_id AND m.role IN (''org_admin'',''org_manager'',''platform_admin'')
        )
      )';
    
    EXECUTE 'CREATE POLICY "rent_schedules_org_delete" ON public.rent_schedules
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.org_memberships m
          WHERE m.user_id = (select auth.uid()) AND m.org_id = rent_schedules.org_id AND m.role IN (''org_admin'',''org_manager'',''platform_admin'')
        )
      )';
  END IF;
END $$;

-- ============================================================================
-- PART 4: ADD PERFORMANCE MONITORING COMMENT
-- ============================================================================

COMMENT ON SCHEMA public IS 'Multiple Permissive Policies and Duplicate Indexes fixed - performance optimized with proper org-scoped RLS policies';
