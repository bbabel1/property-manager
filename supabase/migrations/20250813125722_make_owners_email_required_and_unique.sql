-- Migration: Make owners email required and unique
-- Date: 2025-01-15
-- Description: Makes the email field required (NOT NULL) and unique in the owners table

-- First, handle duplicate emails by appending a unique identifier
-- This will ensure we don't lose data while making the field unique
WITH duplicate_emails AS (
  SELECT email, COUNT(*) as count
  FROM "owners"
  WHERE email IS NOT NULL
  GROUP BY email
  HAVING COUNT(*) > 1
),
numbered_duplicates AS (
  SELECT 
    o.id,
    o.email,
    ROW_NUMBER() OVER (PARTITION BY o.email ORDER BY o.created_at) as rn
  FROM "owners" o
  INNER JOIN duplicate_emails de ON o.email = de.email
)
UPDATE "owners" 
SET "email" = "owners"."email" || '_' || nd.rn
FROM numbered_duplicates nd
WHERE "owners".id = nd.id AND nd.rn > 1;

-- Remove any existing NULL values from the email field
-- This is necessary before making the field NOT NULL
UPDATE "owners" 
SET "email" = 'no-email@placeholder.com' 
WHERE "email" IS NULL;

-- Make the email field NOT NULL
ALTER TABLE "owners" 
ALTER COLUMN "email" SET NOT NULL;

-- Add a unique constraint to prevent duplicate email values
ALTER TABLE "owners" 
ADD CONSTRAINT "owners_email_unique" UNIQUE ("email");

-- Create an index on the email field for better performance
CREATE INDEX IF NOT EXISTS "owners_email_idx" ON "owners"("email");
