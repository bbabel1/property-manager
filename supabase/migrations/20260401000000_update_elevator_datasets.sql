-- Update NYC Open Data elevator datasets and add violation category

-- 1) Refresh elevator dataset defaults and add dedicated slots for active/historic violations and complaints
alter table public.nyc_open_data_integrations
  alter column dataset_elevator_inspections set default 'e5aq-a4j2';

-- Update existing rows still pointing at legacy elevator inspections datasets
update public.nyc_open_data_integrations
  set dataset_elevator_inspections = 'e5aq-a4j2'
where dataset_elevator_inspections in ('nu7n-tubp', 'dedp-nh8d');

comment on column public.nyc_open_data_integrations.dataset_elevator_inspections is 'Dataset ID for DOB NOW Elevator Safety Compliance filings (CAT1/CAT5/periodic).';

alter table public.nyc_open_data_integrations
  add column if not exists dataset_elevator_violations_active text not null default 'rff7-h44d',
  add column if not exists dataset_elevator_violations_historic text not null default '9ucd-umy4',
  add column if not exists dataset_elevator_complaints text not null default 'kqwi-7ncn';

comment on column public.nyc_open_data_integrations.dataset_elevator_violations_active is 'Dataset ID for active elevator violations (Open Data rff7-h44d).';
comment on column public.nyc_open_data_integrations.dataset_elevator_violations_historic is 'Dataset ID for historic elevator violations by date (Open Data 9ucd-umy4).';
comment on column public.nyc_open_data_integrations.dataset_elevator_complaints is 'Dataset ID for elevator complaints (311 → DOB elevator complaints, Open Data kqwi-7ncn).';

-- Keep legacy dataset_elevator_violations for backward compatibility (defaults may be updated elsewhere)

-- 2) Add violation category to distinguish violations vs complaints
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'compliance_violation_category'
    ) THEN
        CREATE TYPE public.compliance_violation_category AS ENUM ('violation', 'complaint');
    END IF;
END $$;

alter table public.compliance_violations
  add column if not exists category public.compliance_violation_category not null default 'violation';

comment on column public.compliance_violations.category is 'Classification of record: violation (default) or complaint.';

create index if not exists idx_compliance_violations_category on public.compliance_violations(category);
