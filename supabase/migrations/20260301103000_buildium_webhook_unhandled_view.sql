-- Surface skipped/dead-letter Buildium webhook events for alerting/monitoring
create or replace view public.buildium_webhook_events_unhandled as
select
  id,
  buildium_webhook_id,
  event_name,
  event_type,
  event_created_at,
  event_entity_id,
  status,
  processed,
  processed_at,
  retry_count,
  error_message,
  error,
  webhook_type,
  signature,
  received_at,
  created_at
from public.buildium_webhook_events
where status in ('skipped', 'dead-letter');

comment on view public.buildium_webhook_events_unhandled is
  'Buildium webhook events that were routed as skipped or dead-letter for alerting/ops.';
