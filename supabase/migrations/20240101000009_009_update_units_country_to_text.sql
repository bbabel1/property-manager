-- Migration: Update units country field to text
-- Description: Change the country field in the units table from character varying(100) to text type

-- Change the country field from character varying(100) to text
ALTER TABLE "public"."units" 
ALTER COLUMN "country" TYPE text;

-- Update the comment to reflect the change
COMMENT ON COLUMN "public"."units"."country" IS 'Country - changed from varchar(100) to text for flexibility';
