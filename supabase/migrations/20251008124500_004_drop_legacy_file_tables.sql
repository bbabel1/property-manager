-- Drop legacy file tables that have been unified into public.files + public.file_links
-- Preserve backward compatibility with read-only views.

-- 1) Drop task_history_files table (if exists), then create a compat view
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'task_history_files'
  ) THEN
    EXECUTE 'DROP TABLE public.task_history_files CASCADE';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.task_history_files AS
SELECT
  f.id::uuid AS id,
  f.buildium_file_id,
  fl.entity_uuid AS task_history_id,
  f.file_name,
  CAST(f.mime_type AS varchar(100)) AS file_type,
  f.size_bytes AS file_size,
  f.external_url AS file_url,
  f.description,
  f.created_at,
  f.updated_at
FROM public.file_links fl
JOIN public.files f ON f.id = fl.file_id
WHERE fl.entity_type = 'task_history';

COMMENT ON VIEW public.task_history_files IS 'Compatibility view mapping unified files/file_links to legacy task_history_files shape';

-- 2) Drop work_order_files table (if exists), then create a compat view
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'work_order_files'
  ) THEN
    EXECUTE 'DROP TABLE public.work_order_files CASCADE';
  END IF;
END $$;

CREATE OR REPLACE VIEW public.work_order_files AS
SELECT
  f.id::uuid AS id,
  fl.entity_uuid AS work_order_id,
  f.buildium_file_id,
  f.file_name,
  f.mime_type AS file_type,
  f.size_bytes AS file_size,
  COALESCE(f.external_url, NULL) AS file_url,
  f.description,
  f.created_at,
  f.updated_at
FROM public.file_links fl
JOIN public.files f ON f.id = fl.file_id
WHERE fl.entity_type = 'work_order';

COMMENT ON VIEW public.work_order_files IS 'Compatibility view mapping unified files/file_links to legacy work_order_files shape';

