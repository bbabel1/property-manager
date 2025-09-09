-- Migration: Drop square_footage column from units
-- Purpose: The units table should use unit_size for area; remove legacy square_footage

BEGIN;

ALTER TABLE public.units
  DROP COLUMN IF EXISTS square_footage;

COMMIT;

