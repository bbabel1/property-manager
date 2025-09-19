-- Migration: Update GL accounts field mapping to match Buildium API
-- Description: Rename parent_gl_account_id to buildium_parent_gl_account_id for proper Buildium field mapping

-- Rename parent_gl_account_id to buildium_parent_gl_account_id (only if source column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'gl_accounts' AND column_name = 'parent_gl_account_id'
  ) THEN
    ALTER TABLE "public"."gl_accounts" 
    RENAME COLUMN "parent_gl_account_id" TO "buildium_parent_gl_account_id";
  END IF;
END $$;

-- Update comment for the renamed column
COMMENT ON COLUMN "public"."gl_accounts"."buildium_parent_gl_account_id" IS 'Buildium API parent GL account ID for hierarchical relationships';
