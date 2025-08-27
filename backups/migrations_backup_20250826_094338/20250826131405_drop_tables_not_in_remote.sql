-- Migration: Drop tables that don't exist in remote database
-- Description: Remove tables that are not part of the remote database schema
-- Author: Property Management System
-- Date: 2025-08-26

-- Drop tables that don't exist in remote database
-- Note: DROP TABLE CASCADE will also remove any dependent objects (indexes, triggers, etc.)

DROP TABLE IF EXISTS public."Account" CASCADE;
DROP TABLE IF EXISTS public."Lease" CASCADE;
DROP TABLE IF EXISTS public."LeaaseContact" CASCADE;
DROP TABLE IF EXISTS public."PropertyStaff" CASCADE;
DROP TABLE IF EXISTS public."Session" CASCADE;
DROP TABLE IF EXISTS public."User" CASCADE;
DROP TABLE IF EXISTS public."VerificationToken" CASCADE;
DROP TABLE IF EXISTS public.bills CASCADE;
DROP TABLE IF EXISTS public.journal_entries CASCADE;
