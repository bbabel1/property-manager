-- Fix properties table updated_at field to have a default value
-- This addresses the issue where properties cannot be created because updated_at is NOT NULL but has no default

-- Add default value to updated_at column
ALTER TABLE "public"."properties" 
ALTER COLUMN "updated_at" SET DEFAULT now();

-- Add comment explaining the fix
COMMENT ON COLUMN "public"."properties"."updated_at" IS 'Timestamp when property was last updated, defaults to now() on insert';
