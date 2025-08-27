-- Migration: Add Missing RLS Policies
-- Date: 2025-01-15
-- Description: Adds missing RLS policies for INSERT, UPDATE, and DELETE operations

-- Properties table policies
CREATE POLICY "Enable insert access for authenticated users" ON "properties" 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON "properties" 
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users" ON "properties" 
  FOR DELETE USING (true);

-- Units table policies
CREATE POLICY "Enable insert access for authenticated users" ON "units" 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON "units" 
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users" ON "units" 
  FOR DELETE USING (true);

-- Owners table policies
CREATE POLICY "Enable insert access for authenticated users" ON "owners" 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON "owners" 
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users" ON "owners" 
  FOR DELETE USING (true);

-- Ownership table policies
CREATE POLICY "Enable insert access for authenticated users" ON "ownership" 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON "ownership" 
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users" ON "ownership" 
  FOR DELETE USING (true);

-- Staff table policies
CREATE POLICY "Enable insert access for authenticated users" ON "Staff" 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON "Staff" 
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users" ON "Staff" 
  FOR DELETE USING (true);

-- PropertyStaff table policies
CREATE POLICY "Enable insert access for authenticated users" ON "PropertyStaff" 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON "PropertyStaff" 
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users" ON "PropertyStaff" 
  FOR DELETE USING (true);

-- Lease table policies
CREATE POLICY "Enable insert access for authenticated users" ON "Lease" 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON "Lease" 
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users" ON "Lease" 
  FOR DELETE USING (true);

-- LeaseContact table policies
CREATE POLICY "Enable insert access for authenticated users" ON "LeaseContact" 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON "LeaseContact" 
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users" ON "LeaseContact" 
  FOR DELETE USING (true);

-- Bank accounts table policies
CREATE POLICY "Enable insert access for authenticated users" ON "bank_accounts" 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users" ON "bank_accounts" 
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete access for authenticated users" ON "bank_accounts" 
  FOR DELETE USING (true);
