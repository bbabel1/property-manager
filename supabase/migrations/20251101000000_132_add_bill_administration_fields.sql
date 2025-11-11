-- Adds bill administration metadata to properties and units and notes for leases
set check_function_bodies = off;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'bill_administration_option') then
    create type public.bill_administration_option as enum (
      'Property Tax',
      'Building Charges',
      'Insurance',
      'Utilities',
      'Other'
    );
  end if;
end
$$;

alter table if exists public.properties
  add column if not exists bill_administration public.bill_administration_option[] default '{}',
  add column if not exists bill_administration_notes text;

alter table if exists public.units
  add column if not exists bill_administration public.bill_administration_option[] default '{}',
  add column if not exists bill_administration_notes text;

alter table if exists public.lease
  add column if not exists lease_charges text;

comment on column public.properties.bill_administration is
  'List of bill administration responsibilities for the property.';
comment on column public.properties.bill_administration_notes is
  'Notes related to property bill administration responsibilities.';

comment on column public.units.bill_administration is
  'List of bill administration responsibilities specific to this unit.';
comment on column public.units.bill_administration_notes is
  'Notes related to unit bill administration responsibilities.';

comment on column public.lease.lease_charges is
  'Notes describing charges to apply to the lease ledger beyond base rent.';
