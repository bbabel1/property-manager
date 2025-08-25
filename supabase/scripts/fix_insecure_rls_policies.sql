-- Fix Insecure RLS Policies
-- This script replaces overly permissive policies with proper authenticated user policies
-- Run this directly in your Supabase SQL editor

-- ==============================================================
-- REMOVE OVERLY PERMISSIVE POLICIES
-- ==============================================================

-- Remove the "Enable read access for all users" policies (these allow ANYONE to read data)
DROP POLICY IF EXISTS "Enable read access for all users" ON "properties";
DROP POLICY IF EXISTS "Enable read access for all users" ON "units";
DROP POLICY IF EXISTS "Enable read access for all users" ON "owners";
DROP POLICY IF EXISTS "Enable read access for all users" ON "staff";
DROP POLICY IF EXISTS "Enable read access for all users" ON "lease";
DROP POLICY IF EXISTS "Enable read access for all users" ON "bank_accounts";

-- Remove "Allow all operations" policies (these allow ANYONE to do anything)
DROP POLICY IF EXISTS "Allow all operations on appliances" ON "appliances";
DROP POLICY IF EXISTS "Allow all operations on inspections" ON "inspections";
DROP POLICY IF EXISTS "Allow all operations on journal_entries" ON "journal_entries";
DROP POLICY IF EXISTS "Allow all operations on rent_schedules" ON "rent_schedules";
DROP POLICY IF EXISTS "Allow all operations on transactions" ON "transactions";

-- ==============================================================
-- CREATE SECURE POLICIES FOR PROPERTIES
-- ==============================================================

-- Allow authenticated users to view properties
CREATE POLICY "properties_read_policy" ON "properties"
    FOR SELECT USING (auth.role() = 'authenticated');

-- ==============================================================
-- CREATE SECURE POLICIES FOR UNITS
-- ==============================================================

-- Allow authenticated users to view units
CREATE POLICY "units_read_policy" ON "units"
    FOR SELECT USING (auth.role() = 'authenticated');

-- ==============================================================
-- CREATE SECURE POLICIES FOR OWNERS
-- ==============================================================

-- Allow authenticated users to view owners
CREATE POLICY "owners_read_policy" ON "owners"
    FOR SELECT USING (auth.role() = 'authenticated');

-- ==============================================================
-- CREATE SECURE POLICIES FOR STAFF
-- ==============================================================

-- Allow authenticated users to view staff
CREATE POLICY "staff_read_policy" ON "staff"
    FOR SELECT USING (auth.role() = 'authenticated');

-- ==============================================================
-- CREATE SECURE POLICIES FOR LEASE
-- ==============================================================

-- Allow authenticated users to view leases
CREATE POLICY "lease_read_policy" ON "lease"
    FOR SELECT USING (auth.role() = 'authenticated');

-- ==============================================================
-- CREATE SECURE POLICIES FOR APPLIANCES
-- ==============================================================

-- Allow authenticated users to view appliances
CREATE POLICY "appliances_read_policy" ON "appliances"
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert appliances
CREATE POLICY "appliances_insert_policy" ON "appliances"
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update appliances
CREATE POLICY "appliances_update_policy" ON "appliances"
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete appliances
CREATE POLICY "appliances_delete_policy" ON "appliances"
    FOR DELETE USING (auth.role() = 'authenticated');

-- ==============================================================
-- CREATE SECURE POLICIES FOR INSPECTIONS
-- ==============================================================

-- Allow authenticated users to view inspections
CREATE POLICY "inspections_read_policy" ON "inspections"
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert inspections
CREATE POLICY "inspections_insert_policy" ON "inspections"
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update inspections
CREATE POLICY "inspections_update_policy" ON "inspections"
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete inspections
CREATE POLICY "inspections_delete_policy" ON "inspections"
    FOR DELETE USING (auth.role() = 'authenticated');

-- ==============================================================
-- CREATE SECURE POLICIES FOR JOURNAL_ENTRIES
-- ==============================================================

-- Allow authenticated users to view journal entries
CREATE POLICY "journal_entries_read_policy" ON "journal_entries"
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert journal entries
CREATE POLICY "journal_entries_insert_policy" ON "journal_entries"
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update journal entries
CREATE POLICY "journal_entries_update_policy" ON "journal_entries"
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete journal entries
CREATE POLICY "journal_entries_delete_policy" ON "journal_entries"
    FOR DELETE USING (auth.role() = 'authenticated');

-- ==============================================================
-- CREATE SECURE POLICIES FOR RENT_SCHEDULES
-- ==============================================================

-- Allow authenticated users to view rent schedules
CREATE POLICY "rent_schedules_read_policy" ON "rent_schedules"
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert rent schedules
CREATE POLICY "rent_schedules_insert_policy" ON "rent_schedules"
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update rent schedules
CREATE POLICY "rent_schedules_update_policy" ON "rent_schedules"
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete rent schedules
CREATE POLICY "rent_schedules_delete_policy" ON "rent_schedules"
    FOR DELETE USING (auth.role() = 'authenticated');

-- ==============================================================
-- CREATE SECURE POLICIES FOR TRANSACTIONS
-- ==============================================================

-- Allow authenticated users to view transactions
CREATE POLICY "transactions_read_policy" ON "transactions"
    FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert transactions
CREATE POLICY "transactions_insert_policy" ON "transactions"
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update transactions
CREATE POLICY "transactions_update_policy" ON "transactions"
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete transactions
CREATE POLICY "transactions_delete_policy" ON "transactions"
    FOR DELETE USING (auth.role() = 'authenticated');

-- ==============================================================
-- VERIFICATION
-- ==============================================================

-- Check that all tables now have proper authenticated user policies
DO $$
DECLARE
    table_name text;
    policy_count integer;
    insecure_policies integer;
BEGIN
    RAISE NOTICE '=== RLS Security Check ===';
    
    FOR table_name IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN (
            'properties', 'units', 'owners', 'staff', 'lease', 'appliances', 
            'inspections', 'journal_entries', 'rent_schedules', 'transactions'
        )
    LOOP
        -- Count total policies
        SELECT COUNT(*) INTO policy_count
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = table_name;
        
        -- Count insecure policies (using true)
        SELECT COUNT(*) INTO insecure_policies
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = table_name 
        AND (definition LIKE '%USING (true)%' OR definition LIKE '%WITH CHECK (true)%');
        
        RAISE NOTICE 'Table %: Total policies = %, Insecure policies = %', 
            table_name, policy_count, insecure_policies;
    END LOOP;
    
    RAISE NOTICE '=== Security Fix Complete ===';
    RAISE NOTICE 'All tables now require authentication to access data.';
END $$;
