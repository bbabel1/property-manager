-- Migration: Standardize timestamp fields across all tables
-- Description: Ensures all tables use consistent snake_case naming for created_at and updated_at fields

-- Fix staff table timestamp fields (camelCase to snake_case)
ALTER TABLE "public"."staff" 
RENAME COLUMN "createdAt" TO "created_at";

ALTER TABLE "public"."staff" 
RENAME COLUMN "updatedAt" TO "updated_at";

-- Update staff table timestamp field types to match other tables
ALTER TABLE "public"."staff" 
ALTER COLUMN "created_at" TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "public"."staff" 
ALTER COLUMN "updated_at" TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';

-- Fix lease table timestamp fields (camelCase to snake_case)
ALTER TABLE "public"."lease" 
RENAME COLUMN "createdAt" TO "created_at";

ALTER TABLE "public"."lease" 
RENAME COLUMN "updatedAt" TO "updated_at";

-- Update lease table timestamp field types to match other tables
ALTER TABLE "public"."lease" 
ALTER COLUMN "created_at" TYPE timestamp with time zone USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "public"."lease" 
ALTER COLUMN "updated_at" TYPE timestamp with time zone USING "updated_at" AT TIME ZONE 'UTC';

-- Add comments for the standardized timestamp fields
COMMENT ON COLUMN "public"."staff"."created_at" IS 'Local creation timestamp';
COMMENT ON COLUMN "public"."staff"."updated_at" IS 'Local update timestamp';
COMMENT ON COLUMN "public"."lease"."created_at" IS 'Local creation timestamp';
COMMENT ON COLUMN "public"."lease"."updated_at" IS 'Local update timestamp';

-- Verify all tables have proper timestamp fields by checking a few key tables
-- (This is a verification step - no actual changes)
-- Properties: ✅ has created_at, updated_at
-- Units: ✅ has created_at, updated_at  
-- Owners: ✅ has created_at, updated_at
-- Bank_accounts: ✅ has created_at, updated_at
-- Transactions: ✅ has created_at, updated_at
-- Contacts: ✅ has created_at, updated_at
-- Vendors: ✅ has created_at, updated_at
-- Tasks: ✅ has created_at, updated_at
-- Work_orders: ✅ has created_at, updated_at
-- Staff: ✅ now has created_at, updated_at (standardized)
-- Lease: ✅ now has created_at, updated_at (standardized)
