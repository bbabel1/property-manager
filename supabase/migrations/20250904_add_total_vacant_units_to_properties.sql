-- Migration: Add total_vacant_units to properties and keep it in sync with units
-- Description: Adds total_vacant_units integer column and reuses the existing
-- update_property_vacant_units_count() trigger function to populate both
-- vacant columns when units are inserted/updated/deleted.

-- 1) Add the new column with a default and not-null constraint
ALTER TABLE "public"."properties"
ADD COLUMN IF NOT EXISTS "total_vacant_units" integer DEFAULT 0 NOT NULL;

COMMENT ON COLUMN "public"."properties"."total_vacant_units" IS
'Count of related units with status = Vacant. Maintained by triggers.';

-- 2) Recreate the trigger function to also update total_vacant_units
--    (This function name already exists in a prior migration and updates
--     properties.vacant_units_count. We extend it to keep both columns in sync.)
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
        )
    WHERE p."id" = _prop_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 3) Backfill existing data
UPDATE "public"."properties" p
SET "total_vacant_units" = (
    SELECT COUNT(*) FROM "public"."units" u
    WHERE u."property_id" = p."id" AND u."status" = 'Vacant' AND u."is_active" = true
);

-- 4) Constraints and index for performance and integrity
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'check_total_vacant_units_non_negative'
    ) THEN
        ALTER TABLE "public"."properties"
            ADD CONSTRAINT "check_total_vacant_units_non_negative"
            CHECK ("total_vacant_units" >= 0);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'check_total_vacant_units_not_exceed_total'
    ) THEN
        ALTER TABLE "public"."properties"
            ADD CONSTRAINT "check_total_vacant_units_not_exceed_total"
            CHECK ("total_vacant_units" <= "total_units");
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_properties_total_vacant_units"
ON "public"."properties" ("total_vacant_units");
