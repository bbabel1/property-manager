-- Add Heat Sensor Program dataset slot and building flag

ALTER TABLE public.nyc_open_data_integrations
  ADD COLUMN IF NOT EXISTS dataset_heat_sensor_program TEXT NOT NULL DEFAULT 'h4mf-f24e';

COMMENT ON COLUMN public.nyc_open_data_integrations.dataset_heat_sensor_program IS 'Dataset ID for Buildings Selected for the Heat Sensor Program (HSP).';

ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS heat_sensor_program boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.buildings.heat_sensor_program IS 'True when building is flagged in HPD Heat Sensor Program dataset.';
