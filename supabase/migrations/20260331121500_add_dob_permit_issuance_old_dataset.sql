-- Add DOB Permit Issuance (OLD / BIS) dataset slot and extend permits table for BIS fields

-- New dataset slot on nyc_open_data_integrations
alter table public.nyc_open_data_integrations
  add column if not exists dataset_dob_permit_issuance_old text not null default 'ipu4-2q9a';

comment on column public.nyc_open_data_integrations.dataset_dob_permit_issuance_old is 'Dataset ID for DOB Permit Issuance (OLD/BIS).';

-- Align elevator devices default to the DOB NOW Build Elevator Devices dataset
alter table public.nyc_open_data_integrations
  alter column dataset_elevator_devices set default 'juyv-2jek';

comment on column public.nyc_open_data_integrations.dataset_elevator_devices is 'Dataset ID for DOB NOW Build – Elevator Devices.';

-- Extend building_permits to accommodate BIS permit issuance fields (metadata still holds full row)
alter table public.building_permits
  add column if not exists job_number text,
  add column if not exists job_doc_number text,
  add column if not exists job_type text,
  add column if not exists filing_status text,
  add column if not exists permit_type text,
  add column if not exists permit_subtype text,
  add column if not exists permit_sequence_number text,
  add column if not exists filing_date date,
  add column if not exists issuance_date date,
  add column if not exists expiration_date date,
  add column if not exists job_start_date date,
  add column if not exists self_cert text,
  add column if not exists oil_gas text,
  add column if not exists site_fill text,
  add column if not exists non_profit text,
  add column if not exists owner_phone text,
  add column if not exists owner_business_type text,
  add column if not exists permittee_first_name text,
  add column if not exists permittee_last_name text,
  add column if not exists permittee_business_name text,
  add column if not exists permittee_phone text,
  add column if not exists permittee_license_type text,
  add column if not exists permittee_license_number text,
  add column if not exists permittee_other_title text,
  add column if not exists act_as_superintendent text,
  add column if not exists hic_license text,
  add column if not exists site_safety_mgr_first_name text,
  add column if not exists site_safety_mgr_last_name text,
  add column if not exists site_safety_mgr_business_name text,
  add column if not exists superintendent_name text,
  add column if not exists superintendent_business_name text,
  add column if not exists owner_first_name text,
  add column if not exists owner_last_name text,
  add column if not exists owner_house_number text,
  add column if not exists owner_house_street_name text,
  add column if not exists owner_house_city text,
  add column if not exists owner_house_state text,
  add column if not exists owner_house_zip_code text,
  add column if not exists owner_house_phone text,
  add column if not exists dataset_run_date date,
  add column if not exists permit_si_no text,
  add column if not exists bldg_type text,
  add column if not exists residential text,
  add column if not exists special_district_1 text,
  add column if not exists special_district_2 text;

create index if not exists building_permits_job_number_idx on public.building_permits (job_number);
create index if not exists building_permits_permit_sequence_idx on public.building_permits (permit_sequence_number);
