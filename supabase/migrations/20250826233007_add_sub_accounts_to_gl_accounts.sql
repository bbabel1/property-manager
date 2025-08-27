-- Migration: Add sub_accounts field to gl_accounts table
-- Description: Add sub_accounts field as UUID array to store child GL account references

-- Add sub_accounts column as UUID array
ALTER TABLE "public"."gl_accounts" 
ADD COLUMN "sub_accounts" "uuid"[] DEFAULT '{}';

-- Add comment for the new column
COMMENT ON COLUMN "public"."gl_accounts"."sub_accounts" IS 'Array of UUIDs referencing child GL accounts. Each UUID represents a sub-account linked to this GL account.';

-- Create index for better performance when querying sub_accounts
CREATE INDEX "idx_gl_accounts_sub_accounts" ON "public"."gl_accounts" USING GIN ("sub_accounts");
