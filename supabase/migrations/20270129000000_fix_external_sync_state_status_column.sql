-- Fix missing status column in external_sync_state table
-- This migration ensures the status column exists even if the original migration
-- was partially applied or the column was accidentally dropped
-- 
-- This addresses the error: "column external_sync_state.status does not exist"
-- that was appearing in compliance sync service logs

-- Ensure the enum exists first (idempotent)
DO $$ BEGIN
    CREATE TYPE "public"."external_sync_status" AS ENUM (
        'idle',
        'running',
        'error'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Ensure the table exists (from original migration)
CREATE TABLE IF NOT EXISTS "public"."external_sync_state" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "org_id" uuid NOT NULL,
    "source" "public"."external_sync_source" NOT NULL,
    "last_cursor" text,
    "last_seen_at" timestamp with time zone,
    "last_run_at" timestamp with time zone,
    "last_error" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "external_sync_state_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "external_sync_state_org_id_source_key" UNIQUE ("org_id", "source"),
    CONSTRAINT "external_sync_state_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT
);

-- Add the status column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'external_sync_state' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE "public"."external_sync_state"
            ADD COLUMN "status" "public"."external_sync_status" DEFAULT 'idle' NOT NULL;
    END IF;
END $$;

-- Update any existing rows that might have NULL status (safety check)
UPDATE "public"."external_sync_state"
SET "status" = 'idle'
WHERE "status" IS NULL;

-- Ensure the column constraints are correct
DO $$ 
BEGIN
    -- Set NOT NULL if not already
    ALTER TABLE "public"."external_sync_state"
        ALTER COLUMN "status" SET NOT NULL,
        ALTER COLUMN "status" SET DEFAULT 'idle';
EXCEPTION
    WHEN OTHERS THEN null; -- Ignore if already set
END $$;

COMMENT ON COLUMN "public"."external_sync_state"."status" IS 'Sync status: idle, running, or error';



