-- Migration: Add total_inactive_units, total_occupied_units, total_active_units
-- Extends the counts on properties and keeps them updated via the existing
-- update_property_vacant_units_count() trigger function.

-- 1) Add new columns
ALTER TABLE "public"."properties"
  ADD COLUMN IF NOT EXISTS "total_inactive_units" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "total_occupied_units" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "total_active_units" integer DEFAULT 0 NOT NULL;

COMMENT ON COLUMN "public"."properties"."total_inactive_units" IS 'Count of related units with status = Inactive';
COMMENT ON COLUMN "public"."properties"."total_occupied_units" IS 'Count of related units with status = Occupied';
COMMENT ON COLUMN "public"."properties"."total_active_units" IS 'Count of related units with status IN (Occupied, Vacant)';

-- 2) Recreate the trigger function so it maintains all totals
CREATE OR REPLACE FUNCTION "public"."update_property_vacant_units_count"()
RETURNS TRIGGER AS $$
DECLARE
  _prop_id uuid;
BEGIN
  _prop_id := COALESCE(NEW."property_id", OLD."property_id");
  IF _prop_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE "public"."properties" p
  SET
    "vacant_units_count" = (
      SELECT COUNT(*) FROM "public"."units" u
      WHERE u."property_id" = _prop_id AND u."status" = 'Vacant' AND u."is_active" = true
    ),
    "total_vacant_units" = (
      SELECT COUNT(*) FROM "public"."units" u
      WHERE u."property_id" = _prop_id AND u."status" = 'Vacant' AND u."is_active" = true
    ),
    "total_inactive_units" = (
      SELECT COUNT(*) FROM "public"."units" u
      WHERE u."property_id" = _prop_id AND u."status" = 'Inactive' AND u."is_active" = true
    ),
    "total_occupied_units" = (
      SELECT COUNT(*) FROM "public"."units" u
      WHERE u."property_id" = _prop_id AND u."status" = 'Occupied' AND u."is_active" = true
    ),
    "total_active_units" = (
      SELECT COUNT(*) FROM "public"."units" u
      WHERE u."property_id" = _prop_id AND u."status" IN ('Occupied','Vacant') AND u."is_active" = true
    )
  WHERE p."id" = _prop_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 3) Backfill existing data
UPDATE "public"."properties" p
SET
  "total_inactive_units" = (
    SELECT COUNT(*) FROM "public"."units" u
    WHERE u."property_id" = p."id" AND u."status" = 'Inactive' AND u."is_active" = true
  ),
  "total_occupied_units" = (
    SELECT COUNT(*) FROM "public"."units" u
    WHERE u."property_id" = p."id" AND u."status" = 'Occupied' AND u."is_active" = true
  ),
  "total_active_units" = (
    SELECT COUNT(*) FROM "public"."units" u
    WHERE u."property_id" = p."id" AND u."status" IN ('Occupied','Vacant') AND u."is_active" = true
  );

-- 4) Constraints (non-negative; not exceeding total_units)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_total_inactive_units_non_negative') THEN
    ALTER TABLE "public"."properties"
      ADD CONSTRAINT "check_total_inactive_units_non_negative"
      CHECK ("total_inactive_units" >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_total_occupied_units_non_negative') THEN
    ALTER TABLE "public"."properties"
      ADD CONSTRAINT "check_total_occupied_units_non_negative"
      CHECK ("total_occupied_units" >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_total_active_units_non_negative') THEN
    ALTER TABLE "public"."properties"
      ADD CONSTRAINT "check_total_active_units_non_negative"
      CHECK ("total_active_units" >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_total_inactive_units_not_exceed_total') THEN
    ALTER TABLE "public"."properties"
      ADD CONSTRAINT "check_total_inactive_units_not_exceed_total"
      CHECK ("total_inactive_units" <= "total_units");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_total_occupied_units_not_exceed_total') THEN
    ALTER TABLE "public"."properties"
      ADD CONSTRAINT "check_total_occupied_units_not_exceed_total"
      CHECK ("total_occupied_units" <= "total_units");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_total_active_units_not_exceed_total') THEN
    ALTER TABLE "public"."properties"
      ADD CONSTRAINT "check_total_active_units_not_exceed_total"
      CHECK ("total_active_units" <= "total_units");
  END IF;
END $$;

-- 5) Indexes
CREATE INDEX IF NOT EXISTS "idx_properties_total_inactive_units" ON "public"."properties" ("total_inactive_units");
CREATE INDEX IF NOT EXISTS "idx_properties_total_occupied_units" ON "public"."properties" ("total_occupied_units");
CREATE INDEX IF NOT EXISTS "idx_properties_total_active_units" ON "public"."properties" ("total_active_units");

