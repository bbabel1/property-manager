-- Consolidate file storage: Create file_categories table and new simplified files table
-- This migration removes the polymorphic file_links table in favor of direct entity_type/entity_id association
-- 1) Create entity_type enum for Buildium file entity types
DO $enum$
DECLARE
    desired_values text[] := ARRAY[
        'Account',
        'Association',
        'AssociationOwner',
        'AssociationUnit',
        'Lease',
        'OwnershipAccount',
        'PublicAsset',
        'Rental',
        'RentalOwner',
        'RentalUnit',
        'Tenant',
        'Vendor'
    ];
    type_exists boolean;
    value text;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'entity_type_enum'
          AND n.nspname = 'public'
    )
    INTO type_exists;

    IF NOT type_exists THEN
        EXECUTE format(
            'CREATE TYPE public.entity_type_enum AS ENUM (%s)',
            array_to_string(
                ARRAY(
                    SELECT quote_literal(v)
                    FROM unnest(desired_values) AS v
                ),
                ', '
            )
        );
    ELSE
        FOR value IN SELECT unnest(desired_values)
        LOOP
            IF NOT EXISTS (
                SELECT 1
                FROM pg_enum e
                JOIN pg_type t ON e.enumtypid = t.oid
                JOIN pg_namespace n ON n.oid = t.typnamespace
                WHERE t.typname = 'entity_type_enum'
                  AND n.nspname = 'public'
                  AND e.enumlabel = value
            ) THEN
                EXECUTE format('ALTER TYPE public.entity_type_enum ADD VALUE IF NOT EXISTS %L', value);
            END IF;
        END LOOP;
    END IF;
END
$enum$;
-- 2) Create file_categories table
CREATE TABLE IF NOT EXISTS public.file_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    category_name text NOT NULL,
    buildium_category_id integer,
    description text,
    is_active boolean DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
-- Unique constraint on buildium_category_id per org (when not null)
CREATE UNIQUE INDEX IF NOT EXISTS file_categories_buildium_category_id_org_uniq ON public.file_categories(org_id, buildium_category_id)
WHERE buildium_category_id IS NOT NULL;
-- Index for org lookups
CREATE INDEX IF NOT EXISTS idx_file_categories_org ON public.file_categories(org_id);
-- Index for active categories
CREATE INDEX IF NOT EXISTS idx_file_categories_active ON public.file_categories(org_id, is_active)
WHERE is_active = true;
-- 3) Drop existing file-related tables and views (CASCADE will drop dependent objects)
DROP VIEW IF EXISTS public.lease_documents CASCADE;
DROP VIEW IF EXISTS public.task_history_files CASCADE;
DROP VIEW IF EXISTS public.work_order_files CASCADE;
DROP TABLE IF EXISTS public.file_links CASCADE;
DROP TABLE IF EXISTS public.files CASCADE;
-- 4) Create new simplified files table
CREATE TABLE public.files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    -- File metadata
    file_name text NOT NULL,
    title text NOT NULL,
    description text,
    mime_type text,
    size_bytes integer,
    -- Entity association (Buildium pattern)
    entity_type entity_type_enum NOT NULL,
    entity_id integer NOT NULL,
    -- Category relationship
    buildium_category_id integer,
    -- Storage information
    storage_provider text CHECK (
        storage_provider IN ('supabase', 's3', 'gcs', 'buildium', 'external')
    ) DEFAULT 'supabase',
    bucket text,
    storage_key text,
    external_url text,
    -- Buildium sync fields
    buildium_file_id integer,
    buildium_href text,
    -- Metadata
    is_private boolean NOT NULL DEFAULT true,
    sha256 text,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);
-- Note: Foreign key to file_categories is not enforced via constraint
-- because buildium_category_id can be null. Instead, we rely on application-level
-- validation to ensure referential integrity when buildium_category_id is set.
-- Unique index on buildium_file_id (when not null)
CREATE UNIQUE INDEX IF NOT EXISTS files_buildium_file_id_uniq ON public.files(buildium_file_id)
WHERE buildium_file_id IS NOT NULL;
-- Index for entity lookups (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_files_entity ON public.files(org_id, entity_type, entity_id);
-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_files_category ON public.files(org_id, buildium_category_id)
WHERE buildium_category_id IS NOT NULL;
-- Index for org lookups
CREATE INDEX IF NOT EXISTS idx_files_org ON public.files(org_id);
-- Index for storage queries
CREATE INDEX IF NOT EXISTS idx_files_storage ON public.files(storage_provider, bucket)
WHERE bucket IS NOT NULL;
-- Index for soft deletes
CREATE INDEX IF NOT EXISTS idx_files_deleted ON public.files(org_id, deleted_at)
WHERE deleted_at IS NULL;
-- 5) Enable RLS on both tables
ALTER TABLE public.file_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
-- 6) RLS policies for file_categories (org-scoped)
DROP POLICY IF EXISTS file_categories_select_org ON public.file_categories;
CREATE POLICY file_categories_select_org ON public.file_categories FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.org_memberships m
            WHERE m.org_id = file_categories.org_id
                AND m.user_id = auth.uid()
        )
    );
DROP POLICY IF EXISTS file_categories_insert_org ON public.file_categories;
CREATE POLICY file_categories_insert_org ON public.file_categories FOR
INSERT WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.org_memberships m
            WHERE m.org_id = file_categories.org_id
                AND m.user_id = auth.uid()
        )
    );
DROP POLICY IF EXISTS file_categories_update_org ON public.file_categories;
CREATE POLICY file_categories_update_org ON public.file_categories FOR
UPDATE USING (
        EXISTS (
            SELECT 1
            FROM public.org_memberships m
            WHERE m.org_id = file_categories.org_id
                AND m.user_id = auth.uid()
        )
    );
DROP POLICY IF EXISTS file_categories_delete_org ON public.file_categories;
CREATE POLICY file_categories_delete_org ON public.file_categories FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM public.org_memberships m
        WHERE m.org_id = file_categories.org_id
            AND m.user_id = auth.uid()
    )
);
-- 7) RLS policies for files (org-scoped)
DROP POLICY IF EXISTS files_select_org ON public.files;
CREATE POLICY files_select_org ON public.files FOR
SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.org_memberships m
            WHERE m.org_id = files.org_id
                AND m.user_id = auth.uid()
        )
    );
DROP POLICY IF EXISTS files_insert_org ON public.files;
CREATE POLICY files_insert_org ON public.files FOR
INSERT WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.org_memberships m
            WHERE m.org_id = files.org_id
                AND m.user_id = auth.uid()
        )
    );
DROP POLICY IF EXISTS files_update_org ON public.files;
CREATE POLICY files_update_org ON public.files FOR
UPDATE USING (
        EXISTS (
            SELECT 1
            FROM public.org_memberships m
            WHERE m.org_id = files.org_id
                AND m.user_id = auth.uid()
        )
    );
DROP POLICY IF EXISTS files_delete_org ON public.files;
CREATE POLICY files_delete_org ON public.files FOR DELETE USING (
    EXISTS (
        SELECT 1
        FROM public.org_memberships m
        WHERE m.org_id = files.org_id
            AND m.user_id = auth.uid()
    )
);
-- 8) Add updated_at triggers
DO $$ BEGIN CREATE TRIGGER trg_file_categories_updated_at BEFORE
UPDATE ON public.file_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION
WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN CREATE TRIGGER trg_files_updated_at BEFORE
UPDATE ON public.files FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION
WHEN duplicate_object THEN NULL;
END $$;
-- Comments for documentation
COMMENT ON TABLE public.file_categories IS 'File categories synced from Buildium, scoped by organization';
COMMENT ON COLUMN public.file_categories.category_name IS 'Name of the file category';
COMMENT ON COLUMN public.file_categories.buildium_category_id IS 'Buildium API category ID for synchronization';
COMMENT ON TABLE public.files IS 'Unified file storage with direct entity association (replaces file_links pattern)';
COMMENT ON COLUMN public.files.file_name IS 'Original filename from upload';
COMMENT ON COLUMN public.files.title IS 'File title (separate from filename per Buildium API)';
COMMENT ON COLUMN public.files.entity_type IS 'Type of entity this file is associated with (from Buildium enum)';
COMMENT ON COLUMN public.files.entity_id IS 'Buildium entity ID for the associated entity';
COMMENT ON COLUMN public.files.buildium_category_id IS 'Reference to file category via Buildium category ID';
