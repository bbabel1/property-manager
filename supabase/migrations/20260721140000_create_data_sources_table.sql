-- Create global data_sources catalog (one row per dataset, developer-managed)

set check_function_bodies = off;

create table if not exists public.data_sources (
    key text primary key,
    dataset_id text not null,
    title text,
    description text,
    is_enabled boolean default true not null,
    created_at timestamptz default now() not null,
    updated_at timestamptz default now() not null,
    deleted_at timestamptz
);

comment on table public.data_sources is 'Global NYC data source catalog (one row per dataset key, developer-managed)';
comment on column public.data_sources.key is 'Stable dataset key (e.g., elevatorDevices, hpdViolations)';
comment on column public.data_sources.dataset_id is 'Socrata/Open Data dataset identifier (e.g., juyv-2jek)';
comment on column public.data_sources.is_enabled is 'Whether this dataset should be used by the platform';

create or replace function public.set_data_sources_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger trg_data_sources_updated_at
before update on public.data_sources
for each row
execute function public.set_data_sources_updated_at();

-- Seed known datasets with current defaults
insert into public.data_sources (key, dataset_id, title, description)
values
    ('elevatorDevices', 'juyv-2jek', 'Elevator Devices (Open Data)', 'Authoritative device master: device_number, BIN, type, status.'),
    ('elevatorInspections', 'e5aq-a4j2', 'Elevator Inspections/Tests', 'Inspection/test history (CAT1/CAT5), dates, outcomes.'),
    ('elevatorViolationsActive', 'rff7-h44d', 'Active Elevator Violations', 'Active elevator-related violations requiring corrective action or missing filings.'),
    ('elevatorViolationsHistoric', '9ucd-umy4', 'Historic Elevator Violations', 'Historic CAT1/CAT5 elevator violations with issuance/disposition details.'),
    ('elevatorComplaints', 'kqwi-7ncn', 'Elevator Complaints (311 → DOB)', 'Elevator complaints routed from 311 to DOB that often trigger inspections/enforcement.'),
    ('dobSafetyViolations', '855j-jady', 'DOB Safety Violations', 'Civil penalties issued/payable in DOB NOW (primary violation feed).'),
    ('dobViolations', '3h2n-5cm9', 'DOB Violations (Older)', 'Legacy BIS civil penalties; superseded by DOB Safety Violations for newer issuances.'),
    ('dobActiveViolations', '6drr-tyq2', 'Active DOB Violations', 'Open DOB violations subset for BIN.'),
    ('dobEcbViolations', '6bgk-3dad', 'DOB ECB Violations', 'Summonses issued by DOB adjudicated by OATH/ECB.'),
    ('dobComplaints', 'eabe-havv', 'DOB Complaints Received', 'Universe of complaints received by DOB.'),
    ('bedbugReporting', 'wz6d-d3jb', 'Bedbug Reporting', 'Annual bedbug self-report filings with BIN/BBL and unit counts.'),
    ('dobNowApprovedPermits', 'rbx6-tga4', 'DOB NOW: Build – Approved Permits', 'Approved construction permits in DOB NOW (except Electrical/Elevator/LAA).'),
    ('dobNowJobFilings', 'w9ak-ipjd', 'DOB NOW: Build – Job Application Filings', 'Job application filings submitted through DOB NOW.'),
    ('dobNowSafetyBoiler', '52dp-yji6', 'DOB NOW: Safety Boiler', 'Annual compliance filings for high and low pressure boilers.'),
    ('dobNowSafetyFacade', 'xubg-57si', 'DOB NOW: Safety – Facades Compliance Filings', 'All Facades compliance filings submitted in DOB NOW.'),
    ('dobPermitIssuanceOld', 'ipu4-2q9a', 'DOB Permit Issuance (OLD/BIS)', 'Legacy BIS permit issuance records (NB/DM/Alt1/2/3).'),
    ('dobJobApplications', 'ic3t-wcy2', 'DOB Job Application Filings (BIS)', 'Job applications submitted via BIS (pre-DOB NOW).'),
    ('dobCertificateOfOccupancyOld', 'bs8b-p36w', 'DOB Certificate Of Occupancy (Old)', 'COs issued via BIS up to March 2021.'),
    ('dobCertificateOfOccupancyNow', 'pkdm-hqz6', 'DOB NOW: Certificate of Occupancy', 'COs issued through DOB NOW Certificate of Occupancy module.'),
    ('hpdViolations', 'wvxf-dwi5', 'Housing Maintenance Code Violations', 'HPD housing code violations (HMC/MDL).'),
    ('hpdComplaints', 'ygpa-z7cr', 'HPD Complaints / Problems', 'HPD complaints/problems (precursors to violations).'),
    ('hpdRegistrations', 'tesw-yqqr', 'HPD Registrations', 'Annual HPD registrations for covered buildings.'),
    ('fdnyViolations', 'avgm-ztsb', 'FDNY Violations', 'FDNY Fire Code violations.'),
    ('asbestosViolations', 'r6c3-8mpt', 'Asbestos Violations', 'DEP asbestos violations.'),
    ('sidewalkViolations', '6kbp-uz6m', 'Sidewalk Violations', 'NYC DOT Sidewalk Management Database - Violations (BBL scoped).'),
    ('backflowPreventionViolations', '38n4-tikp', 'Backflow Prevention Violations', 'OATH violations filtered for backflow prevention devices.'),
    ('heatSensorProgram', 'h4mf-f24e', 'Heat Sensor Program Buildings', 'Buildings selected for the Heat Sensor Program (HSP).')
on conflict (key) do update
set dataset_id = excluded.dataset_id,
    title = excluded.title,
    description = excluded.description,
    is_enabled = true,
    deleted_at = null;

-- No RLS: developer-managed global catalog
