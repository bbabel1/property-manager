-- Unified files storage schema: files + file_links with org-scoped RLS

-- 1) Core tables
CREATE TABLE IF NOT EXISTS public.files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  -- provenance / storage
  source text CHECK (source IN ('local','buildium','external','generated')) DEFAULT 'local',
  storage_provider text CHECK (storage_provider IN ('supabase','s3','gcs','buildium','external')) DEFAULT 'supabase',
  bucket text,
  storage_key text,
  external_url text,
  -- metadata
  file_name text NOT NULL,
  mime_type text,
  size_bytes integer,
  sha256 text,
  is_private boolean NOT NULL DEFAULT true,
  -- Buildium mapping
  buildium_file_id integer,
  buildium_entity_type text,
  buildium_entity_id integer,
  buildium_href text,
  -- misc
  description text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Ensure partial uniqueness for Buildium file ids when present
CREATE UNIQUE INDEX IF NOT EXISTS files_buildium_file_id_uniq
  ON public.files(buildium_file_id) WHERE buildium_file_id IS NOT NULL;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_files_org ON public.files(org_id);
CREATE INDEX IF NOT EXISTS idx_files_org_sha ON public.files(org_id, sha256);
CREATE INDEX IF NOT EXISTS idx_files_storage ON public.files(storage_provider, bucket);

-- updated_at trigger
DO $$ BEGIN
  CREATE TRIGGER trg_files_updated_at
  BEFORE UPDATE ON public.files
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Association table for polymorphic linking
CREATE TABLE IF NOT EXISTS public.file_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_uuid uuid,
  entity_int integer,
  org_id uuid NOT NULL,
  role text,
  category text,
  sort_index integer,
  added_by uuid,
  added_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT file_links_one_entity_ck CHECK (
    (entity_uuid IS NOT NULL AND entity_int IS NULL) OR (entity_uuid IS NULL AND entity_int IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_file_links_file ON public.file_links(file_id);
CREATE INDEX IF NOT EXISTS idx_file_links_entity_uuid ON public.file_links(entity_type, entity_uuid) WHERE entity_uuid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_file_links_entity_int ON public.file_links(entity_type, entity_int) WHERE entity_int IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_file_links_org ON public.file_links(org_id);

-- 2) RLS policies (org-scoped)
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_links ENABLE ROW LEVEL SECURITY;

-- files: org-membership-based access
DROP POLICY IF EXISTS files_select_org ON public.files;
CREATE POLICY files_select_org ON public.files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.org_id = files.org_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS files_insert_org ON public.files;
CREATE POLICY files_insert_org ON public.files
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.org_id = files.org_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS files_update_org ON public.files;
CREATE POLICY files_update_org ON public.files
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.org_id = files.org_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS files_delete_org ON public.files;
CREATE POLICY files_delete_org ON public.files
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.org_id = files.org_id AND m.user_id = auth.uid()
    )
  );

-- file_links: org-membership-based access
DROP POLICY IF EXISTS file_links_select_org ON public.file_links;
CREATE POLICY file_links_select_org ON public.file_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.org_id = file_links.org_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS file_links_insert_org ON public.file_links;
CREATE POLICY file_links_insert_org ON public.file_links
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.org_id = file_links.org_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS file_links_update_org ON public.file_links;
CREATE POLICY file_links_update_org ON public.file_links
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.org_id = file_links.org_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS file_links_delete_org ON public.file_links;
CREATE POLICY file_links_delete_org ON public.file_links
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.org_id = file_links.org_id AND m.user_id = auth.uid()
    )
  );

