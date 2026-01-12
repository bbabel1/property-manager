-- Add transaction-level property/unit/account entity scoping and enforce line alignment

begin;

-- New scope columns on transactions
alter table public.transactions
  add column if not exists property_id uuid references public.properties(id) on delete set null,
  add column if not exists unit_id uuid references public.units(id) on delete set null,
  add column if not exists account_entity_type public.entity_type_enum,
  add column if not exists account_entity_id integer;

-- Backfill property_id for transactions that have unit_id but no property_id
update public.transactions t
set property_id = u.property_id
from public.units u
where t.unit_id = u.id
  and t.property_id is null
  and t.unit_id is not null;

-- Unit requires property on header
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_transactions_unit_requires_property'
  ) then
    alter table public.transactions
      add constraint chk_transactions_unit_requires_property
      check (unit_id is null or property_id is not null)
      not valid;
  end if;
end $$;

-- Org guards using existing enforce_same_org helper
create or replace function public.transactions_property_org_guard()
returns trigger language plpgsql as $$
declare p_org uuid;
begin
  select org_id into p_org from public.properties where id = new.property_id;
  perform public.enforce_same_org(new.org_id, p_org, 'transactions');
  return new;
end;
$$;

drop trigger if exists transactions_property_org_guard on public.transactions;
create trigger transactions_property_org_guard
  before insert or update on public.transactions
  for each row
  when (new.property_id is not null)
  execute function public.transactions_property_org_guard();

create or replace function public.transactions_unit_org_guard()
returns trigger language plpgsql as $$
declare u_org uuid;
begin
  select org_id into u_org from public.units where id = new.unit_id;
  perform public.enforce_same_org(new.org_id, u_org, 'transactions');
  return new;
end;
$$;

drop trigger if exists transactions_unit_org_guard on public.transactions;
create trigger transactions_unit_org_guard
  before insert or update on public.transactions
  for each row
  when (new.unit_id is not null)
  execute function public.transactions_unit_org_guard();

-- Validate lines match transaction header scope
create or replace function public.validate_transaction_scope()
returns trigger
language plpgsql
as $$
declare
  v_property_id uuid;
  v_unit_id uuid;
begin
  select property_id, unit_id
  into v_property_id, v_unit_id
  from public.transactions
  where id = new.transaction_id;

  if not found then
    raise exception 'Transaction % not found for scope validation', new.transaction_id;
  end if;

  if v_property_id is distinct from new.property_id then
    raise exception 'Transaction line property_id must match transaction header'
      using errcode = '23514';
  end if;

  if v_unit_id is distinct from new.unit_id then
    raise exception 'Transaction line unit_id must match transaction header'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_transaction_scope on public.transaction_lines;
create trigger trg_validate_transaction_scope
  before insert or update on public.transaction_lines
  for each row
  execute function public.validate_transaction_scope();

-- Recreate replace_transaction_lines to default scope from header and enforce alignment
create or replace function replace_transaction_lines(
  p_transaction_id uuid,
  p_lines jsonb,
  p_validate_balance boolean default true
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line_record jsonb;
  v_now timestamptz := now();
  v_property_id uuid;
  v_unit_id uuid;
  v_account_entity_type public.entity_type_enum;
  v_account_entity_id integer;
  v_prop_in uuid;
  v_unit_in uuid;
  v_account_entity_type_in public.entity_type_enum;
  v_account_entity_id_in integer;
begin
  -- Lock and fetch scope defaults from transaction header
  select property_id, unit_id, account_entity_type, account_entity_id
  into v_property_id, v_unit_id, v_account_entity_type, v_account_entity_id
  from public.transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Transaction % not found', p_transaction_id;
  end if;

  -- Delete existing lines
  delete from transaction_lines
  where transaction_id = p_transaction_id;

  -- Insert new lines from JSONB array
  for v_line_record in select * from jsonb_array_elements(p_lines)
  loop
    v_prop_in := coalesce(
      nullif((v_line_record->>'property_id')::text, 'null')::uuid,
      v_property_id
    );
    v_unit_in := coalesce(
      nullif((v_line_record->>'unit_id')::text, 'null')::uuid,
      v_unit_id
    );

    if v_property_id is not null and v_prop_in is distinct from v_property_id then
      raise exception 'Line property_id must match transaction property_id';
    end if;

    if v_unit_id is not null and v_unit_in is distinct from v_unit_id then
      raise exception 'Line unit_id must match transaction unit_id';
    end if;

    if v_unit_in is not null and v_prop_in is null then
      raise exception 'Line unit_id requires property_id';
    end if;

    v_account_entity_type_in := coalesce(
      nullif(v_line_record->>'account_entity_type', 'null')::public.entity_type_enum,
      v_account_entity_type,
      'Rental'::public.entity_type_enum
    );
    v_account_entity_id_in := coalesce(
      nullif((v_line_record->>'account_entity_id')::text, 'null')::integer,
      v_account_entity_id
    );

    insert into transaction_lines (
      transaction_id,
      gl_account_id,
      amount,
      posting_type,
      memo,
      account_entity_type,
      account_entity_id,
      property_id,
      unit_id,
      lease_id,
      buildium_property_id,
      buildium_unit_id,
      buildium_lease_id,
      date,
      created_at,
      updated_at,
      reference_number,
      is_cash_posting
    ) values (
      p_transaction_id,
      (v_line_record->>'gl_account_id')::uuid,
      (v_line_record->>'amount')::numeric,
      (v_line_record->>'posting_type')::text,
      nullif(v_line_record->>'memo', 'null'),
      v_account_entity_type_in,
      v_account_entity_id_in,
      v_prop_in,
      v_unit_in,
      nullif((v_line_record->>'lease_id')::text, 'null')::uuid,
      nullif((v_line_record->>'buildium_property_id')::text, 'null')::integer,
      nullif((v_line_record->>'buildium_unit_id')::text, 'null')::integer,
      nullif((v_line_record->>'buildium_lease_id')::text, 'null')::integer,
      coalesce((v_line_record->>'date')::date, current_date),
      coalesce((v_line_record->>'created_at')::timestamptz, v_now),
      coalesce((v_line_record->>'updated_at')::timestamptz, v_now),
      nullif(v_line_record->>'reference_number', 'null'),
      coalesce((v_line_record->>'is_cash_posting')::boolean, false)
    );
  end loop;

  -- Validate balance if requested
  if p_validate_balance then
    perform validate_transaction_balance(p_transaction_id);
  end if;

exception
  when others then
    raise;
end;
$$;

-- Indexes for scoped lookups
create index if not exists idx_transactions_property_id on public.transactions(property_id) where property_id is not null;
create index if not exists idx_transactions_unit_id on public.transactions(unit_id) where unit_id is not null;

-- Validate check constraints
alter table public.transactions validate constraint chk_transactions_unit_requires_property;

commit;
