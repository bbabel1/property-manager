-- Fix v_gl_account_balances_as_of to filter property-scoped balances by Rental entity type
-- Global balances include all entity types, property-scoped balances only include Rental

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
  -- Global aggregation includes all entity types
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
bank_tx_agg as (
  select
    t.bank_gl_account_id as gl_account_id,
    sum(
      case
        when lower(coalesce(t.transaction_type::text, '')) in (
          'payment',
          'electronicfundstransfer',
          'applydeposit',
          'refund',
          'unreversedpayment',
          'unreversedelectronicfundstransfer',
          'reverseelectronicfundstransfer',
          'reversepayment'
        ) then -abs(coalesce(t.total_amount, 0))
        when lower(coalesce(t.transaction_type::text, '')) in (
          'deposit',
          'ownercontribution',
          'unreversedownercontribution',
          'generaljournalentry'
        ) then abs(coalesce(t.total_amount, 0))
        else 0
      end
    )::numeric as net,
    count(*)::bigint as tx_count
  from public.transactions t
  join accounts a on a.id = t.bank_gl_account_id
  where t.date <= p_as_of
  group by t.bank_gl_account_id
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
  -- Property-scoped aggregation only includes Rental entity type
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
    -- CRITICAL: Only include Rental entity type for property-scoped balances
    tl.account_entity_type = 'Rental'::public.entity_type_enum
    and (
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
  (coalesce(g.debits, 0) - coalesce(g.credits, 0) + coalesce(bt.net, 0))::numeric as balance,
  coalesce(g.lines_count, 0)::bigint + coalesce(bt.tx_count, 0)::bigint as lines_count,
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
left join bank_tx_agg bt on bt.gl_account_id = a.id

union all

-- Property-scoped rows (all accounts x all properties in org, left-joined to aggregates)
-- Only includes Rental entity type transactions
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
'Org-scoped GL balances as-of date. Global rows include transaction_lines plus transactions.bank_gl_account_id (deposits minus payments) for all entity types. Property rows only include Rental entity type transactions to ensure accurate property-level balances.';
