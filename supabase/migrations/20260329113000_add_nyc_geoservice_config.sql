-- Add geoservice config columns to nyc_open_data_integrations for NYC Geoservice integration

alter table public.nyc_open_data_integrations
  add column if not exists geoservice_api_key_encrypted text,
  add column if not exists geoservice_base_url text;
