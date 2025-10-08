-- Migration: Add status to rent_schedules
-- Description: Creates rent_schedule_status enum and adds status column to rent_schedules
-- Date: 2025-09-25

DO $$
BEGIN
  CREATE TYPE public.rent_schedule_status AS ENUM ('Past', 'Current', 'Future');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.rent_schedules
  ADD COLUMN IF NOT EXISTS status public.rent_schedule_status NOT NULL DEFAULT 'Current';

COMMENT ON COLUMN public.rent_schedules.status IS 'Lifecycle status for the rent schedule (Past, Current, Future)';
