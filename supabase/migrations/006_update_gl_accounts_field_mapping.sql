-- Migration: Update GL accounts field mapping to match Buildium API
-- Description: Rename parent_gl_account_id to buildium_parent_gl_account_id for proper Buildium field mapping

-- Rename parent_gl_account_id to buildium_parent_gl_account_id
ALTER TABLE "public"."gl_accounts" 
RENAME COLUMN "parent_gl_account_id" TO "buildium_parent_gl_account_id";

-- Update comment for the renamed column
COMMENT ON COLUMN "public"."gl_accounts"."buildium_parent_gl_account_id" IS 'Buildium API parent GL account ID for hierarchical relationships';
