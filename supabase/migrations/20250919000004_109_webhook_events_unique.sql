-- Migration: Add unique constraints to webhook events table
-- Description: Prevents duplicate webhook events from being processed
-- Date: 2025-09-19
-- Add unique constraint to prevent duplicate webhook events
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'uq_buildium_webhook_events_event_id'
        AND table_name = 'buildium_webhook_events'
) THEN
ALTER TABLE public.buildium_webhook_events
ADD CONSTRAINT uq_buildium_webhook_events_event_id UNIQUE (event_id);
END IF;
END $$;
-- Add index for better webhook processing performance
CREATE INDEX IF NOT EXISTS idx_buildium_webhook_events_processed ON public.buildium_webhook_events(processed, processed_at);
CREATE INDEX IF NOT EXISTS idx_buildium_webhook_events_created_at ON public.buildium_webhook_events(created_at DESC);