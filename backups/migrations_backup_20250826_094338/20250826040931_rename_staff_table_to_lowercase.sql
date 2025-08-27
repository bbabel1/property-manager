-- Migration: Rename Staff table to staff to match remote database
-- Description: Renames the 'Staff' table to 'staff' to match remote database naming
-- Author: Property Management System
-- Date: 2025-08-26

-- Rename the table from 'Staff' to 'staff'
ALTER TABLE public."Staff" RENAME TO staff;
