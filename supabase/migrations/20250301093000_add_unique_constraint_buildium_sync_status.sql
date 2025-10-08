alter table public.buildium_sync_status
  add constraint buildium_sync_status_entity_unique
  unique (entity_type, entity_id);
