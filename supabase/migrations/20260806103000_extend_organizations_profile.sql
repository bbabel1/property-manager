-- Extend organizations profile fields to match manager UI and internal API requirements

-- Accounting enums
do $$
begin
  create type public.accounting_basis_enum as enum ('Accrual', 'Cash');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.trust_account_warning_enum as enum ('Off', 'ByProperty', 'ByRentalOwner');
exception
  when duplicate_object then null;
end $$;

-- New organization profile fields
alter table public.organizations
  add column if not exists company_name text,
  add column if not exists url text,
  add column if not exists contact_first_name text,
  add column if not exists contact_last_name text,
  add column if not exists contact_address_line1 text,
  add column if not exists contact_address_line2 text,
  add column if not exists contact_address_line3 text,
  add column if not exists contact_city text,
  add column if not exists contact_state text,
  add column if not exists contact_postal_code text,
  add column if not exists contact_country public.countries,
  add column if not exists contact_phone_number text,
  add column if not exists accounting_book_id integer,
  add column if not exists default_bank_account_id integer,
  add column if not exists default_accounting_basis public.accounting_basis_enum default 'Accrual'::public.accounting_basis_enum,
  add column if not exists trust_account_warning public.trust_account_warning_enum default 'Off'::public.trust_account_warning_enum,
  add column if not exists fiscal_year_end_month smallint,
  add column if not exists fiscal_year_end_day smallint;

-- Backfill and enforce defaults
update public.organizations
set company_name = coalesce(company_name, name),
    default_accounting_basis = coalesce(default_accounting_basis, 'Accrual'::public.accounting_basis_enum),
    trust_account_warning = coalesce(trust_account_warning, 'Off'::public.trust_account_warning_enum);

alter table public.organizations
  alter column default_accounting_basis set not null,
  alter column trust_account_warning set not null;

-- Guardrails for fiscal year fields
alter table public.organizations
  drop constraint if exists organizations_fiscal_year_end_month_check,
  add constraint organizations_fiscal_year_end_month_check check (
    fiscal_year_end_month is null or (fiscal_year_end_month between 1 and 12)
  ),
  drop constraint if exists organizations_fiscal_year_end_day_check,
  add constraint organizations_fiscal_year_end_day_check check (
    fiscal_year_end_day is null or (fiscal_year_end_day between 1 and 31)
  );

-- Keep name and company_name aligned for legacy callers
create or replace function public.sync_organization_name()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    new.company_name := coalesce(new.company_name, new.name);
    new.name := coalesce(new.name, new.company_name);
    if new.company_name is distinct from new.name then
      new.company_name := new.name;
    end if;
  else
    if new.company_name is distinct from old.company_name then
      new.name := coalesce(new.company_name, new.name, old.name);
      new.company_name := new.name;
    elsif new.name is distinct from old.name then
      new.company_name := coalesce(new.name, new.company_name, old.company_name);
      new.name := new.company_name;
    else
      new.company_name := coalesce(new.company_name, new.name, old.company_name);
      new.name := coalesce(new.name, new.company_name, old.name);
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists sync_organization_name on public.organizations;
create trigger sync_organization_name
  before insert or update on public.organizations
  for each row execute function public.sync_organization_name();
