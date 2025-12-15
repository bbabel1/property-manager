-- Backfill nyc_datasource_id in compliance_programs.override_fields using existing nyc_datasource_key.

update public.compliance_programs cp
set override_fields = jsonb_set(
    coalesce(cp.override_fields, '{}'::jsonb),
    '{nyc_datasource_id}',
    to_jsonb(ds.id),
    true
  )
from public.data_sources ds
where (cp.override_fields ->> 'nyc_datasource_id') is null
  and (cp.override_fields ->> 'nyc_datasource_key') = ds.key
  and ds.deleted_at is null;
