-- Remote patch: enable RLS and org-scoped policies for unified files tables

ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_links ENABLE ROW LEVEL SECURITY;

-- files policies
DO $$ BEGIN
  DROP POLICY IF EXISTS files_select_org ON public.files;
  CREATE POLICY files_select_org ON public.files
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.org_memberships m WHERE m.org_id = files.org_id AND m.user_id = auth.uid())
    );
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS files_insert_org ON public.files;
  CREATE POLICY files_insert_org ON public.files
    FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.org_memberships m WHERE m.org_id = files.org_id AND m.user_id = auth.uid())
    );
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS files_update_org ON public.files;
  CREATE POLICY files_update_org ON public.files
    FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.org_memberships m WHERE m.org_id = files.org_id AND m.user_id = auth.uid())
    );
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS files_delete_org ON public.files;
  CREATE POLICY files_delete_org ON public.files
    FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.org_memberships m WHERE m.org_id = files.org_id AND m.user_id = auth.uid())
    );
EXCEPTION WHEN others THEN NULL; END $$;

-- file_links policies
DO $$ BEGIN
  DROP POLICY IF EXISTS file_links_select_org ON public.file_links;
  CREATE POLICY file_links_select_org ON public.file_links
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.org_memberships m WHERE m.org_id = file_links.org_id AND m.user_id = auth.uid())
    );
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS file_links_insert_org ON public.file_links;
  CREATE POLICY file_links_insert_org ON public.file_links
    FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.org_memberships m WHERE m.org_id = file_links.org_id AND m.user_id = auth.uid())
    );
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS file_links_update_org ON public.file_links;
  CREATE POLICY file_links_update_org ON public.file_links
    FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.org_memberships m WHERE m.org_id = file_links.org_id AND m.user_id = auth.uid())
    );
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS file_links_delete_org ON public.file_links;
  CREATE POLICY file_links_delete_org ON public.file_links
    FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.org_memberships m WHERE m.org_id = file_links.org_id AND m.user_id = auth.uid())
    );
EXCEPTION WHEN others THEN NULL; END $$;

