-- Migration: Cleanup bank_accounts table
-- Description: Remove check printing and information fields, make key fields non-nullable

-- Remove check printing related fields
ALTER TABLE "public"."bank_accounts" DROP COLUMN IF EXISTS "enable_remote_check_printing";
ALTER TABLE "public"."bank_accounts" DROP COLUMN IF EXISTS "enable_local_check_printing";
ALTER TABLE "public"."bank_accounts" DROP COLUMN IF EXISTS "check_layout_type";
ALTER TABLE "public"."bank_accounts" DROP COLUMN IF EXISTS "signature_heading";
ALTER TABLE "public"."bank_accounts" DROP COLUMN IF EXISTS "fractional_number";

-- Remove bank information fields
ALTER TABLE "public"."bank_accounts" DROP COLUMN IF EXISTS "bank_information_line1";
ALTER TABLE "public"."bank_accounts" DROP COLUMN IF EXISTS "bank_information_line2";
ALTER TABLE "public"."bank_accounts" DROP COLUMN IF EXISTS "bank_information_line3";
ALTER TABLE "public"."bank_accounts" DROP COLUMN IF EXISTS "bank_information_line4";
ALTER TABLE "public"."bank_accounts" DROP COLUMN IF EXISTS "bank_information_line5";

-- Remove company information fields
ALTER TABLE "public"."bank_accounts" DROP COLUMN IF EXISTS "company_information_line1";
ALTER TABLE "public"."bank_accounts" DROP COLUMN IF EXISTS "company_information_line2";
ALTER TABLE "public"."bank_accounts" DROP COLUMN IF EXISTS "company_information_line3";
ALTER TABLE "public"."bank_accounts" DROP COLUMN IF EXISTS "company_information_line4";
ALTER TABLE "public"."bank_accounts" DROP COLUMN IF EXISTS "company_information_line5";

-- Remove country field
ALTER TABLE "public"."bank_accounts" DROP COLUMN IF EXISTS "country";

-- Make buildium_bank_id non-nullable (first ensure no null values exist)
UPDATE "public"."bank_accounts" SET "buildium_bank_id" = 0 WHERE "buildium_bank_id" IS NULL;
ALTER TABLE "public"."bank_accounts" ALTER COLUMN "buildium_bank_id" SET NOT NULL;

-- Make name non-nullable (first ensure no null values exist)
UPDATE "public"."bank_accounts" SET "name" = 'Unnamed Account' WHERE "name" IS NULL;
ALTER TABLE "public"."bank_accounts" ALTER COLUMN "name" SET NOT NULL;

-- Make gl_account non-nullable (first ensure no null values exist)
-- Note: This will require creating a default GL account or handling existing null values
-- For now, we'll create a default GL account if none exists
INSERT INTO "public"."gl_accounts" (
    "buildium_gl_account_id", 
    "name", 
    "type", 
    "is_active", 
    "created_at", 
    "updated_at"
) 
SELECT 0, 'Default Bank Account GL', 'Asset', true, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "public"."gl_accounts" WHERE "buildium_gl_account_id" = 0);

-- Update bank accounts with null gl_account to use the default GL account
UPDATE "public"."bank_accounts" 
SET "gl_account" = (SELECT "id" FROM "public"."gl_accounts" WHERE "buildium_gl_account_id" = 0 LIMIT 1)
WHERE "gl_account" IS NULL;

-- Now make gl_account non-nullable
ALTER TABLE "public"."bank_accounts" ALTER COLUMN "gl_account" SET NOT NULL;
