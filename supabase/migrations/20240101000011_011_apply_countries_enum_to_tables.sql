-- Migration: Apply countries enum to country fields across all tables
-- Description: Update all country fields to use the standardized countries enum type

-- Update contacts table country fields
-- First remove the default value, then change type, then add new default
ALTER TABLE "public"."contacts" 
ALTER COLUMN "primary_country" DROP DEFAULT;

ALTER TABLE "public"."contacts" 
ALTER COLUMN "primary_country" TYPE "public"."countries" USING "primary_country"::"public"."countries";

ALTER TABLE "public"."contacts" 
ALTER COLUMN "primary_country" SET DEFAULT 'United States'::"public"."countries";

ALTER TABLE "public"."contacts" 
ALTER COLUMN "alt_country" TYPE "public"."countries" USING "alt_country"::"public"."countries";

-- Update owners table country field
ALTER TABLE "public"."owners" 
ALTER COLUMN "tax_country" TYPE "public"."countries" USING "tax_country"::"public"."countries";

-- Update properties table country field
ALTER TABLE "public"."properties" 
ALTER COLUMN "country" TYPE "public"."countries" USING "country"::"public"."countries";

-- Update units table country field
ALTER TABLE "public"."units" 
ALTER COLUMN "country" TYPE "public"."countries" USING "country"::"public"."countries";

-- Update vendors table country field
ALTER TABLE "public"."vendors" 
ALTER COLUMN "country" TYPE "public"."countries" USING "country"::"public"."countries";

-- Update comments to reflect the enum usage
COMMENT ON COLUMN "public"."contacts"."primary_country" IS 'Primary address country - uses standardized countries enum';
COMMENT ON COLUMN "public"."contacts"."alt_country" IS 'Alternative address country - uses standardized countries enum';
COMMENT ON COLUMN "public"."owners"."tax_country" IS 'Tax address country - uses standardized countries enum';
COMMENT ON COLUMN "public"."properties"."country" IS 'Property address country - uses standardized countries enum';
COMMENT ON COLUMN "public"."units"."country" IS 'Unit address country - uses standardized countries enum';
COMMENT ON COLUMN "public"."vendors"."country" IS 'Vendor address country - uses standardized countries enum';
