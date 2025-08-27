-- Remove remaining fields that don't exist in remote owners table
-- Local has 16 fields, remote has 10 fields
-- Remove: last_contacted, buildium_owner_id, is_active, buildium_created_at, buildium_updated_at, tax_include1099

ALTER TABLE public.owners DROP COLUMN IF EXISTS last_contacted;
ALTER TABLE public.owners DROP COLUMN IF EXISTS buildium_owner_id;
ALTER TABLE public.owners DROP COLUMN IF EXISTS is_active;
ALTER TABLE public.owners DROP COLUMN IF EXISTS buildium_created_at;
ALTER TABLE public.owners DROP COLUMN IF EXISTS buildium_updated_at;
ALTER TABLE public.owners DROP COLUMN IF EXISTS tax_include1099;
