-- Rename camelCase/PascalCase columns in public.lease and public.staff to snake_case
-- Safe-guarded with IF EXISTS checks

DO $$
BEGIN
  -- lease.propertyId -> lease.property_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'lease' AND column_name = 'propertyId'
  ) THEN
    EXECUTE 'ALTER TABLE public.lease RENAME COLUMN "propertyId" TO property_id';
  END IF;

  -- lease.unitId -> lease.unit_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'lease' AND column_name = 'unitId'
  ) THEN
    EXECUTE 'ALTER TABLE public.lease RENAME COLUMN "unitId" TO unit_id';
  END IF;

  -- staff.isActive -> staff.is_active
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'staff' AND column_name = 'isActive'
  ) THEN
    EXECUTE 'ALTER TABLE public.staff RENAME COLUMN "isActive" TO is_active';
  END IF;
END $$;

