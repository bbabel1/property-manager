-- Add geoservice app_id storage alongside app key for Geoclient v2

alter table public.nyc_open_data_integrations
  add column if not exists geoservice_app_id_encrypted text;
