-- GL account balances surface (as-of, org-scoped)
-- - Adds org-scoped as-of balance functions mirroring property scoping semantics
-- - Adds optional snapshot table + refresh procedure for caching/audit

begin;

------------------------------
-- 1) Snapshot table: gl_account_balances
------------------------------

create table if not exists public.gl_account_balances (
  org_id uuid not null references public.organizations(id) on delete restrict,
  gl_account_id uuid not null references public.gl_accounts(id) on delete cascade,
  property_id uuid null references public.properties(id) on delete cascade,
  as_of_date date not null,
  balance numeric(15,2) not null,
  source text not null default 'local',
  computed_at timestamptz not null default now(),
  payload jsonb null
);

comment on table public.gl_account_balances is
'Optional snapshots of GL account balances as of a date. Rows may be global (property_id null) or property-scoped.';

create unique index if not exists uq_gl_account_balances_org_account_property_asof
  on public.gl_account_balances (org_id, gl_account_id, property_id, as_of_date);

create index if not exists idx_gl_account_balances_org_asof_property
  on public.gl_account_balances (org_id, as_of_date, property_id);

create index if not exists idx_gl_account_balances_org_account_asof
  on public.gl_account_balances (org_id, gl_account_id, as_of_date);

alter table public.gl_account_balances enable row level security;

-- Mirror current gl_accounts policy style (org_memberships-based).
drop policy if exists "gl_account_balances_org_member_read" on public.gl_account_balances;
create policy "gl_account_balances_org_member_read" on public.gl_account_balances
  for select using (
    public.is_org_member((select auth.uid()), public.gl_account_balances.org_id)
  );

drop policy if exists "gl_account_balances_org_admin_update" on public.gl_account_balances;
create policy "gl_account_balances_org_admin_update" on public.gl_account_balances
  for update using (
    public.is_org_admin_or_manager((select auth.uid()), public.gl_account_balances.org_id)
  )
  with check (
    public.is_org_admin_or_manager((select auth.uid()), public.gl_account_balances.org_id)
  );

drop policy if exists "gl_account_balances_org_admin_insert" on public.gl_account_balances;
create policy "gl_account_balances_org_admin_insert" on public.gl_account_balances
  for insert with check (
    public.is_org_admin_or_manager((select auth.uid()), public.gl_account_balances.org_id)
  );

drop policy if exists "gl_account_balances_org_admin_delete" on public.gl_account_balances;
create policy "gl_account_balances_org_admin_delete" on public.gl_account_balances
  for delete using (
    public.is_org_admin_or_manager((select auth.uid()), public.gl_account_balances.org_id)
  );

------------------------------
-- 2) Function: gl_account_balance_as_of (org-scoped)
------------------------------

create or replace function public.gl_account_balance_as_of(
  p_org_id uuid,
  p_gl_account_id uuid,
  p_as_of date,
  p_property_id uuid default null
) returns numeric
language plpgsql
stable
as $$
declare
  v_property record;
begin
  -- Ensure the GL account belongs to this org.
  if not exists (
    select 1 from public.gl_accounts ga
    where ga.id = p_gl_account_id
      and ga.org_id = p_org_id
  ) then
    raise exception 'gl_account_id % not found in org %', p_gl_account_id, p_org_id;
  end if;

  if p_property_id is not null then
    select
      p.id,
      p.org_id,
      p.buildium_property_id,
      p.operating_bank_gl_account_id,
      p.deposit_trust_gl_account_id
    into v_property
    from public.properties p
    where p.id = p_property_id;

    if not found then
      raise exception 'property_id % not found', p_property_id;
    end if;

    if v_property.org_id <> p_org_id then
      raise exception 'property_id % not in org %', p_property_id, p_org_id;
    end if;
  end if;

  return coalesce((
    select
      coalesce(sum(case when lower(coalesce(tl.posting_type, '')) = 'debit' then abs(coalesce(tl.amount, 0)) else 0 end), 0)
      -
      coalesce(sum(case when lower(coalesce(tl.posting_type, '')) = 'credit' then abs(coalesce(tl.amount, 0)) else 0 end), 0)
    from public.transaction_lines tl
    where tl.gl_account_id = p_gl_account_id
      and tl.date <= p_as_of
      and (
        p_property_id is null
        or (
          -- Inclusion rules: property_id, unit->property, lease->property, buildium_lease_id, buildium_property_id fallback
          tl.property_id = v_property.id
          or (tl.unit_id is not null and exists (
            select 1 from public.units u
            where u.id = tl.unit_id and u.property_id = v_property.id
          ))
          or (tl.lease_id is not null and exists (
            select 1 from public.lease l
            where l.id = tl.lease_id and l.property_id = v_property.id
          ))
          or (tl.buildium_lease_id is not null and exists (
            select 1 from public.lease l2
            where l2.buildium_lease_id = tl.buildium_lease_id and l2.property_id = v_property.id
          ))
          or (v_property.buildium_property_id is not null and tl.buildium_property_id = v_property.buildium_property_id)
          -- Bank GL special-case: if this GL account is the property's operating/deposit bank GL,
          -- include lines even when entity linkage is missing.
          or (p_gl_account_id = v_property.operating_bank_gl_account_id)
          or (p_gl_account_id = v_property.deposit_trust_gl_account_id)
        )
      )
  ), 0)::numeric;
end;
$$;

comment on function public.gl_account_balance_as_of(uuid, uuid, date, uuid) is
'Returns debit-minus-credit balance for a GL account up to an as-of date, org-scoped. When property_id is provided, includes lines scoped by property/unit/lease/buildium_lease_id/buildium_property_id and includes operating/deposit bank GL lines even if unscoped.';

------------------------------
-- 3) Set-returning function: v_gl_account_balances_as_of (org-scoped)
------------------------------

create or replace function public.v_gl_account_balances_as_of(
  p_org_id uuid,
  p_as_of date
) returns table (
  org_id uuid,
  gl_account_id uuid,
  property_id uuid,
  as_of_date date,
  debits numeric,
  credits numeric,
  balance numeric,
  lines_count bigint,
  account_number text,
  name text,
  type text,
  sub_type text,
  is_active boolean,
  is_bank_account boolean,
  is_credit_card_account boolean,
  is_contra_account boolean,
  exclude_from_cash_balances boolean,
  buildium_gl_account_id integer,
  buildium_parent_gl_account_id integer
)
language sql
stable
as $$
with accounts as (
  select
    ga.id,
    ga.org_id,
    ga.account_number,
    ga.name,
    ga.type,
    ga.sub_type,
    ga.is_active,
    ga.is_bank_account,
    ga.is_credit_card_account,
    ga.is_contra_account,
    coalesce(ga.exclude_from_cash_balances, false) as exclude_from_cash_balances,
    ga.buildium_gl_account_id,
    ga.buildium_parent_gl_account_id
  from public.gl_accounts ga
  where ga.org_id = p_org_id
),
global_agg as (
  select
    tl.gl_account_id,
    coalesce(sum(case when lower(coalesce(tl.posting_type, '')) = 'debit' then abs(coalesce(tl.amount, 0)) else 0 end), 0)::numeric as debits,
    coalesce(sum(case when lower(coalesce(tl.posting_type, '')) = 'credit' then abs(coalesce(tl.amount, 0)) else 0 end), 0)::numeric as credits,
    count(*)::bigint as lines_count
  from public.transaction_lines tl
  join accounts a on a.id = tl.gl_account_id
  where tl.date <= p_as_of
  group by tl.gl_account_id
),
properties_in_org as (
  select
    p.id,
    p.buildium_property_id,
    p.operating_bank_gl_account_id,
    p.deposit_trust_gl_account_id
  from public.properties p
  where p.org_id = p_org_id
),
property_agg as (
  select
    p.id as property_id,
    tl.gl_account_id,
    coalesce(sum(case when lower(coalesce(tl.posting_type, '')) = 'debit' then abs(coalesce(tl.amount, 0)) else 0 end), 0)::numeric as debits,
    coalesce(sum(case when lower(coalesce(tl.posting_type, '')) = 'credit' then abs(coalesce(tl.amount, 0)) else 0 end), 0)::numeric as credits,
    count(*)::bigint as lines_count
  from properties_in_org p
  join public.transaction_lines tl
    on tl.date <= p_as_of
  join accounts a on a.id = tl.gl_account_id
  where
    (
      tl.property_id = p.id
      or (tl.unit_id is not null and exists (
        select 1 from public.units u
        where u.id = tl.unit_id and u.property_id = p.id
      ))
      or (tl.lease_id is not null and exists (
        select 1 from public.lease l
        where l.id = tl.lease_id and l.property_id = p.id
      ))
      or (tl.buildium_lease_id is not null and exists (
        select 1 from public.lease l2
        where l2.buildium_lease_id = tl.buildium_lease_id and l2.property_id = p.id
      ))
      or (p.buildium_property_id is not null and tl.buildium_property_id = p.buildium_property_id)
      or (p.operating_bank_gl_account_id is not null and tl.gl_account_id = p.operating_bank_gl_account_id)
      or (p.deposit_trust_gl_account_id is not null and tl.gl_account_id = p.deposit_trust_gl_account_id)
    )
  group by p.id, tl.gl_account_id
)
-- Global (property_id null)
select
  a.org_id as org_id,
  a.id as gl_account_id,
  null::uuid as property_id,
  p_as_of as as_of_date,
  coalesce(g.debits, 0)::numeric as debits,
  coalesce(g.credits, 0)::numeric as credits,
  (coalesce(g.debits, 0) - coalesce(g.credits, 0))::numeric as balance,
  coalesce(g.lines_count, 0)::bigint as lines_count,
  a.account_number,
  a.name,
  a.type,
  a.sub_type,
  a.is_active,
  a.is_bank_account,
  a.is_credit_card_account,
  a.is_contra_account,
  a.exclude_from_cash_balances,
  a.buildium_gl_account_id,
  a.buildium_parent_gl_account_id
from accounts a
left join global_agg g on g.gl_account_id = a.id

union all

-- Property-scoped rows (all accounts x all properties in org, left-joined to aggregates)
select
  a.org_id as org_id,
  a.id as gl_account_id,
  p.id as property_id,
  p_as_of as as_of_date,
  coalesce(pa.debits, 0)::numeric as debits,
  coalesce(pa.credits, 0)::numeric as credits,
  (coalesce(pa.debits, 0) - coalesce(pa.credits, 0))::numeric as balance,
  coalesce(pa.lines_count, 0)::bigint as lines_count,
  a.account_number,
  a.name,
  a.type,
  a.sub_type,
  a.is_active,
  a.is_bank_account,
  a.is_credit_card_account,
  a.is_contra_account,
  a.exclude_from_cash_balances,
  a.buildium_gl_account_id,
  a.buildium_parent_gl_account_id
from accounts a
cross join properties_in_org p
left join property_agg pa
  on pa.property_id = p.id and pa.gl_account_id = a.id;
$$;

comment on function public.v_gl_account_balances_as_of(uuid, date) is
'Set-returning function (named like a view) returning org-scoped GL balances as-of date. Emits global rows (property_id null) and property-scoped rows (property_id set) with line counts for debugging.';

------------------------------
-- 4) Procedure: refresh_gl_account_balances (org-scoped)
------------------------------

create or replace procedure public.refresh_gl_account_balances(
  p_org_id uuid,
  p_as_of date default current_date
)
language plpgsql
as $$
declare
  v_now timestamptz := now();
begin
  insert into public.gl_account_balances (
    org_id,
    gl_account_id,
    property_id,
    as_of_date,
    balance,
    source,
    computed_at,
    payload
  )
  select
    v.org_id,
    v.gl_account_id,
    v.property_id,
    v.as_of_date,
    coalesce(v.balance, 0)::numeric(15,2) as balance,
    'local'::text as source,
    v_now as computed_at,
    jsonb_build_object(
      'input', jsonb_build_object(
        'orgId', v.org_id,
        'asOfDate', v.as_of_date,
        'propertyId', v.property_id
      ),
      'output', jsonb_build_object(
        'balance', coalesce(v.balance, 0),
        'debits', coalesce(v.debits, 0),
        'credits', coalesce(v.credits, 0)
      ),
      'debug', jsonb_build_object(
        'linesCount', coalesce(v.lines_count, 0)
      ),
      'computedAt', v_now
    ) as payload
  from public.v_gl_account_balances_as_of(p_org_id, p_as_of) v
  on conflict (org_id, gl_account_id, property_id, as_of_date)
  do update set
    balance = excluded.balance,
    source = excluded.source,
    computed_at = excluded.computed_at,
    payload = excluded.payload;
end;
$$;

comment on procedure public.refresh_gl_account_balances(uuid, date) is
'Populates/refreshes gl_account_balances snapshots for an org and as-of date from v_gl_account_balances_as_of. Stores inputs/outputs and optional line counts in payload for debug/audit.';

commit;


