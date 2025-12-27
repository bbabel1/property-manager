-- Update v_gl_account_balances_as_of() to filter property-scoped balances by Rental entity type
-- Global balances include all entity types (unchanged)

begin;

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
    and tl.account_entity_type = 'Rental'::public.entity_type_enum
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
-- Global (property_id null) - includes all entity types
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
-- Filtered by Rental entity type only
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
'Set-returning function (named like a view) returning org-scoped GL balances as-of date. Emits global rows (property_id null) with all entity types, and property-scoped rows (property_id set) filtered to Rental entity type only.';

commit;

