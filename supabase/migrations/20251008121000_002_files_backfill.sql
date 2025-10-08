-- Backfill unified files from existing per-entity tables

-- Work Order Files -> files + file_links
DO $$
BEGIN
  INSERT INTO public.files (
    org_id, source, storage_provider, external_url,
    file_name, mime_type, size_bytes, description,
    buildium_file_id, created_at, updated_at
  )
  SELECT w.org_id,
         CASE WHEN wof.buildium_file_id IS NOT NULL THEN 'buildium' ELSE 'external' END AS source,
         CASE WHEN wof.buildium_file_id IS NOT NULL THEN 'buildium' ELSE 'external' END AS storage_provider,
         wof.file_url,
         wof.file_name,
         wof.file_type,
         wof.file_size,
         wof.description,
         wof.buildium_file_id,
         COALESCE(wof.created_at, now()),
         COALESCE(wof.updated_at, now())
  FROM public.work_order_files wof
  JOIN public.work_orders w ON w.id = wof.work_order_id
  ON CONFLICT (buildium_file_id) WHERE (public.files.buildium_file_id IS NOT NULL) DO NOTHING;

  -- Link rows
  INSERT INTO public.file_links (file_id, entity_type, entity_uuid, org_id, role, category, sort_index, added_by, added_at)
  SELECT f.id, 'work_order', wof.work_order_id, w.org_id, 'attachment', NULL, NULL, NULL,
         COALESCE(wof.created_at, now())
  FROM public.work_order_files wof
  JOIN public.work_orders w ON w.id = wof.work_order_id
  JOIN public.files f ON (
    (f.buildium_file_id IS NOT NULL AND f.buildium_file_id = wof.buildium_file_id)
    OR (f.buildium_file_id IS NULL AND f.org_id = w.org_id AND f.file_name = wof.file_name AND f.external_url = wof.file_url)
  );
EXCEPTION WHEN undefined_table THEN
  -- Skip if source tables do not exist
  NULL;
END $$;

-- Task History Files -> files + file_links
DO $$
BEGIN
  INSERT INTO public.files (
    org_id, source, storage_provider, external_url,
    file_name, mime_type, size_bytes, description,
    buildium_file_id, created_at, updated_at
  )
  SELECT p.org_id,
         CASE WHEN thf.buildium_file_id IS NOT NULL THEN 'buildium' ELSE 'external' END AS source,
         CASE WHEN thf.buildium_file_id IS NOT NULL THEN 'buildium' ELSE 'external' END AS storage_provider,
         thf.file_url,
         thf.file_name,
         thf.file_type,
         thf.file_size,
         thf.description,
         thf.buildium_file_id,
         COALESCE(thf.created_at, now()),
         COALESCE(thf.updated_at, now())
  FROM public.task_history_files thf
  JOIN public.task_history th ON th.id = thf.task_history_id
  JOIN public.tasks t ON t.id = th.task_id
  JOIN public.properties p ON p.id = t.property_id
  ON CONFLICT (buildium_file_id) WHERE (public.files.buildium_file_id IS NOT NULL) DO NOTHING;

  INSERT INTO public.file_links (file_id, entity_type, entity_uuid, org_id, role, category, sort_index, added_by, added_at)
  SELECT f.id, 'task_history', thf.task_history_id, p.org_id, 'attachment', NULL, NULL, NULL,
         COALESCE(thf.created_at, now())
  FROM public.task_history_files thf
  JOIN public.task_history th ON th.id = thf.task_history_id
  JOIN public.tasks t ON t.id = th.task_id
  JOIN public.properties p ON p.id = t.property_id
  JOIN public.files f ON (
    (f.buildium_file_id IS NOT NULL AND f.buildium_file_id = thf.buildium_file_id)
    OR (f.buildium_file_id IS NULL AND f.org_id = p.org_id AND f.file_name = thf.file_name AND f.external_url = thf.file_url)
  );
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- Lease Documents -> files + file_links (if table exists)
DO $$
BEGIN
  INSERT INTO public.files (
    org_id, source, storage_provider, bucket, storage_key,
    file_name, mime_type, size_bytes, sha256, is_private,
    description, created_at, updated_at
  )
  SELECT p.org_id,
         'local' AS source,
         'supabase' AS storage_provider,
         'lease-documents' AS bucket,
         ld.storage_path,
         ld.name,
         ld.mime_type,
         ld.size_bytes,
         ld.sha256,
         COALESCE(ld.is_private, true),
         NULL,
         COALESCE(ld.created_at, now()),
         COALESCE(ld.updated_at, now())
  FROM public.lease_documents ld
  JOIN public.lease l ON l.id = ld.lease_id
  JOIN public.properties p ON p.id = l.property_id
  ON CONFLICT DO NOTHING;

  INSERT INTO public.file_links (file_id, entity_type, entity_int, org_id, role, category, sort_index, added_by, added_at)
  SELECT f.id, 'lease', ld.lease_id, p.org_id, 'document', ld.category, NULL, NULL,
         COALESCE(ld.created_at, now())
  FROM public.lease_documents ld
  JOIN public.lease l ON l.id = ld.lease_id
  JOIN public.properties p ON p.id = l.property_id
  JOIN public.files f ON (
    f.org_id = p.org_id
    AND f.storage_provider = 'supabase'
    AND f.bucket = 'lease-documents'
    AND f.storage_key = ld.storage_path
  );
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

