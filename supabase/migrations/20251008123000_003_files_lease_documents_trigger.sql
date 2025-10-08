-- Keep unified files in sync when legacy lease_documents is used by code paths

CREATE OR REPLACE FUNCTION public.fn_sync_lease_document_to_files()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_org uuid;
  v_file_id uuid;
BEGIN
  SELECT p.org_id INTO v_org
  FROM public.lease l
  JOIN public.properties p ON p.id = l.property_id
  WHERE l.id = NEW.lease_id;

  -- Upsert file row
  INSERT INTO public.files (
    org_id, source, storage_provider, bucket, storage_key,
    file_name, mime_type, size_bytes, sha256, is_private,
    description, created_at, updated_at
  ) VALUES (
    v_org, 'local', 'supabase', 'lease-documents', NEW.storage_path,
    NEW.name, NEW.mime_type, NEW.size_bytes, NEW.sha256, COALESCE(NEW.is_private, true),
    NULL, COALESCE(NEW.created_at, now()), COALESCE(NEW.updated_at, now())
  ) ON CONFLICT DO NOTHING
  RETURNING id INTO v_file_id;

  IF v_file_id IS NULL THEN
    SELECT f.id INTO v_file_id FROM public.files f
    WHERE f.org_id = v_org AND f.storage_provider = 'supabase' AND f.bucket = 'lease-documents' AND f.storage_key = NEW.storage_path
    LIMIT 1;
  END IF;

  -- Link to lease
  IF v_file_id IS NOT NULL THEN
    INSERT INTO public.file_links (file_id, entity_type, entity_int, org_id, role, category, added_at)
    VALUES (v_file_id, 'lease', NEW.lease_id, v_org, 'document', NEW.category, COALESCE(NEW.created_at, now()))
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DO $$ BEGIN
  DROP TRIGGER IF EXISTS trg_lease_documents_to_files ON public.lease_documents;
  CREATE TRIGGER trg_lease_documents_to_files
  AFTER INSERT ON public.lease_documents
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_lease_document_to_files();
EXCEPTION WHEN undefined_table THEN NULL; END $$;
