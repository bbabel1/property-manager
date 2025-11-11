-- Add category foreign key to files table
-- This migration adds a direct foreign key relationship from files.category to file_categories.id
-- This provides database-level referential integrity in addition to the buildium_category_id field
-- 1) Add category column (nullable, since not all files may have categories)
ALTER TABLE public.files
ADD COLUMN IF NOT EXISTS category uuid;
-- 2) Add foreign key constraint to file_categories.id
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'files_category_fkey'
        AND conrelid = 'public.files'::regclass
) THEN
ALTER TABLE public.files
ADD CONSTRAINT files_category_fkey FOREIGN KEY (category) REFERENCES public.file_categories(id) ON DELETE
SET NULL;
END IF;
END $$;
-- 3) Add index for category lookups (performance optimization)
CREATE INDEX IF NOT EXISTS idx_files_category_fk ON public.files(org_id, category)
WHERE category IS NOT NULL;
-- 4) Add comment for documentation
COMMENT ON COLUMN public.files.category IS 'Direct foreign key reference to file_categories.id for database-level referential integrity';