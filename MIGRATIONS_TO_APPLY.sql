-- ============================================================================
-- DOUBLE-ENTRY BOOKKEEPING BALANCE FIX MIGRATIONS
-- ============================================================================
-- Apply these migrations in order using Supabase Dashboard > SQL Editor
-- Copy each migration section below and run it separately
-- ============================================================================

-- ============================================================================
-- MIGRATION 1/4: Backfill account_entity_type
-- ============================================================================
-- Description: Backfill missing account_entity_type values and add constraints
-- ============================================================================

-- Backfill missing account_entity_type values based on property_id/unit_id/lease_id presence
-- This ensures all transaction lines have a valid entity type for proper balance calculations

begin;

-- Set account_entity_type to 'Rental' for lines linked to properties/units/leases
UPDATE public.transaction_lines
SET account_entity_type = 'Rental'::public.entity_type_enum
WHERE account_entity_type IS NULL
  AND (
    property_id IS NOT NULL 
    OR unit_id IS NOT NULL 
    OR lease_id IS NOT NULL
    OR buildium_property_id IS NOT NULL
    OR buildium_unit_id IS NOT NULL
    OR buildium_lease_id IS NOT NULL
  );

-- Set account_entity_type to 'Company' for lines not linked to properties/units/leases
UPDATE public.transaction_lines
SET account_entity_type = 'Company'::public.entity_type_enum
WHERE account_entity_type IS NULL
  AND property_id IS NULL
  AND unit_id IS NULL
  AND lease_id IS NULL
  AND buildium_property_id IS NULL
  AND buildium_unit_id IS NULL
  AND buildium_lease_id IS NULL;

-- Add constraint to ensure account_entity_type is never null going forward
ALTER TABLE public.transaction_lines
  ALTER COLUMN account_entity_type SET DEFAULT 'Rental'::public.entity_type_enum;

-- Add check constraint to prevent NULL values (after backfill)
ALTER TABLE public.transaction_lines
  ADD CONSTRAINT transaction_lines_account_entity_type_not_null 
  CHECK (account_entity_type IS NOT NULL);

comment on constraint transaction_lines_account_entity_type_not_null on public.transaction_lines is
'Ensures account_entity_type is always set to enable proper entity-type filtering in balance calculations';

commit;

-- ============================================================================
-- MIGRATION 2/4: Fix gl_account_balance_as_of
-- ============================================================================
-- Description: Fix gl_account_balance_as_of to filter by entity type
-- ============================================================================

-- Fix balance calculation functions to filter by account_entity_type
-- This ensures Rental and Company transactions are calculated separately

begin;

-- Fix gl_account_balance_as_of to accept optional entity_type filter
create or replace function public.gl_account_balance_as_of(
  p_org_id uuid,
  p_gl_account_id uuid,
  p_as_of date,
  p_property_id uuid default null,
  p_entity_type public.entity_type_enum default null
) returns numeric
language plpgsql
stable
as $$
declare
  v_property record;
  v_bank_tx numeric := 0;
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

  -- Sum transactions that explicitly point at this bank GL (header field).
  -- Only include for global queries (property_id is null)
  -- Note: transactions table doesn't have entity_type, so we include all for global queries
  if p_property_id is null then
    select coalesce(sum(
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
    ), 0)::numeric
    into v_bank_tx
    from public.transactions t
    where t.bank_gl_account_id = p_gl_account_id
      and t.org_id = p_org_id
      and t.date <= p_as_of;
  end if;

  return coalesce((
    select
      coalesce(sum(case when lower(coalesce(tl.posting_type, '')) = 'debit' then abs(coalesce(tl.amount, 0)) else 0 end), 0)
      -
      coalesce(sum(case when lower(coalesce(tl.posting_type, '')) = 'credit' then abs(coalesce(tl.amount, 0)) else 0 end), 0)
    from public.transaction_lines tl
    where tl.gl_account_id = p_gl_account_id
      and tl.date <= p_as_of
      -- Filter by entity type: for property queries, default to Rental; otherwise use provided filter or include all
      and (
        p_property_id is not null 
          -- For property-scoped queries, only include Rental entity type
          ? tl.account_entity_type = 'Rental'::public.entity_type_enum
          -- For global queries, filter by provided entity type or include all if null
          : (p_entity_type is null or tl.account_entity_type = p_entity_type)
      )
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
          -- include lines even when entity linkage is missing, but only Rental entity type
          or (
            (p_gl_account_id = v_property.operating_bank_gl_account_id
             or p_gl_account_id = v_property.deposit_trust_gl_account_id)
            and tl.account_entity_type = 'Rental'::public.entity_type_enum
          )
        )
      )
  ), 0)::numeric + coalesce(v_bank_tx, 0);
end;
$$;

comment on function public.gl_account_balance_as_of(uuid, uuid, date, uuid, public.entity_type_enum) is
'Returns debit-minus-credit balance for a GL account up to an as-of date, org-scoped. 
Includes transaction_lines + transactions.bank_gl_account_id (deposits minus payments). 
When property_id is provided, includes linked lines for that property and filters by Rental entity type.
When p_entity_type is provided, filters transaction_lines by that entity type.';

commit;

-- ============================================================================
-- MIGRATION 3/4: Fix get_property_financials
-- ============================================================================
-- Description: Fix get_property_financials to only include Rental entity type
-- ============================================================================

-- Fix get_property_financials to only include Rental entity type transactions
-- This ensures property cash balances don't include Company-level transactions

create or replace function public.get_property_financials(
    p_property_id uuid,
    p_as_of date default current_date
) returns jsonb
language plpgsql
stable
as $$
declare
    v_reserve numeric := 0;
    v_balance numeric := 0;
    v_deposits numeric := 0;
    v_prepay numeric := 0;
    v_result jsonb;
    v_operating_bank_gl_account_id uuid;
    v_deposit_trust_gl_account_id uuid;
begin
    select
      coalesce(reserve, 0),
      coalesce(cash_balance, 0),
      operating_bank_gl_account_id,
      deposit_trust_gl_account_id
    into v_reserve, v_balance, v_operating_bank_gl_account_id, v_deposit_trust_gl_account_id
    from public.properties
    where id = p_property_id;
    -- deposits_held_balance and prepayments_balance don't exist on properties table
    -- They exist on units table, but for property-level fallback we use 0
    v_deposits := 0;
    v_prepay := 0;

    with property_units as (
        select id from public.units where property_id = p_property_id
    ),
    property_leases as (
        select id, buildium_lease_id from public.lease where property_id = p_property_id
    ),
    raw_lines as (
        select tl.*, ga.name as ga_name, ga.type as ga_type, ga.sub_type as ga_sub_type,
               ga.is_bank_account as ga_is_bank, ga.is_security_deposit_liability as ga_is_sdl,
               coalesce(ga.exclude_from_cash_balances, false) as ga_exclude
        from public.transaction_lines tl
        join public.gl_accounts ga on ga.id = tl.gl_account_id
        where tl.date <= p_as_of
          -- CRITICAL: Only include Rental entity type transactions for property financials
          and tl.account_entity_type = 'Rental'::public.entity_type_enum
          and (
            tl.property_id = p_property_id
            or tl.unit_id in (select id from property_units)
            or tl.lease_id in (select id from property_leases)
            or tl.buildium_lease_id in (
              select buildium_lease_id from property_leases where buildium_lease_id is not null
            )
            -- Include transaction_lines posted to the property's configured bank GL accounts
            -- even if they don't have property_id/unit_id/lease_id set, but only Rental entity type
            or (
              (v_operating_bank_gl_account_id IS NOT NULL AND tl.gl_account_id = v_operating_bank_gl_account_id)
              or (v_deposit_trust_gl_account_id IS NOT NULL AND tl.gl_account_id = v_deposit_trust_gl_account_id)
            )
          )
    ),
    classified as (
        select
          id,
          transaction_id,
          amount,
          posting_type,
          ga_type,
          ga_sub_type,
          ga_name,
          ga_is_bank,
          ga_is_sdl,
          ga_exclude,
          (ga_is_bank = true
            or lower(coalesce(ga_sub_type,'')) like '%cash%'
            or lower(coalesce(ga_name,'')) ~ '(bank|checking|operating|trust)'
            or lower(coalesce(ga_type,'')) = 'asset') as bank_flag,
          (ga_is_sdl = true
            or (lower(coalesce(ga_sub_type,'')) like '%deposit%' and lower(coalesce(ga_type,'')) = 'liability')
            or lower(coalesce(ga_name,'')) like '%deposit%') as deposit_flag,
          ((lower(coalesce(ga_sub_type,'')) like '%prepay%'
             or lower(coalesce(ga_sub_type,'')) like '%prepaid%'
             or lower(coalesce(ga_sub_type,'')) like '%advance%'
             or lower(coalesce(ga_name,'')) like '%prepay%'
             or lower(coalesce(ga_name,'')) like '%advance%')
            and lower(coalesce(ga_type,'')) = 'liability') as prepay_flag,
          lower(coalesce(ga_sub_type,'')) = 'accountsreceivable' as ar_flag
        from raw_lines
        where ga_exclude = false
    ),
    signed_lines as (
        select
          *,
          case
            when lower(coalesce(ga_type,'')) in ('liability','equity','income') then
              case when lower(coalesce(posting_type,'')) = 'debit' then -abs(coalesce(amount,0)) else abs(coalesce(amount,0)) end
            else
              case when lower(coalesce(posting_type,'')) = 'debit' then abs(coalesce(amount,0)) else -abs(coalesce(amount,0)) end
          end as signed,
          case
            when lower(coalesce(posting_type,'')) = 'debit' then -abs(coalesce(amount,0)) else abs(coalesce(amount,0)) end as liability_signed
        from classified
    ),
    line_totals as (
        select
          coalesce(sum(case when bank_flag then signed else 0 end),0) as bank_total,
          coalesce(sum(case when deposit_flag then liability_signed else 0 end),0) as deposit_total,
          coalesce(sum(case when prepay_flag then liability_signed else 0 end),0) as prepay_total,
          coalesce(sum(case when ar_flag then signed else 0 end),0) as ar_fallback,
          -- Debug: also calculate using simple debit/credit logic for comparison
          coalesce(sum(case when bank_flag and lower(coalesce(posting_type,'')) = 'debit' then abs(coalesce(amount,0)) else 0 end),0) - 
          coalesce(sum(case when bank_flag and lower(coalesce(posting_type,'')) = 'credit' then abs(coalesce(amount,0)) else 0 end),0) as bank_total_simple,
          -- Debug: count bank lines
          count(case when bank_flag then 1 end) as bank_line_count,
          -- Debug: sum of debits and credits separately
          coalesce(sum(case when bank_flag and lower(coalesce(posting_type,'')) = 'debit' then abs(coalesce(amount,0)) else 0 end),0) as bank_debits_total,
          coalesce(sum(case when bank_flag and lower(coalesce(posting_type,'')) = 'credit' then abs(coalesce(amount,0)) else 0 end),0) as bank_credits_total,
          array_remove(array_agg(case when deposit_flag and transaction_id is not null then transaction_id::text else null end), null) as deposit_tx_ids,
          array_remove(array_agg(case when prepay_flag and transaction_id is not null then transaction_id::text else null end), null) as prepay_tx_ids
        from signed_lines
    ),
    payment_lines as (
      select transaction_id::text as tx_id, sum(abs(coalesce(amount,0))) as total
      from signed_lines
      where transaction_id is not null
      group by transaction_id
    ),
    payment_tx as (
      select coalesce(
        sum(abs(coalesce(t.total_amount,0)))
          filter (where lower(coalesce(t.transaction_type::text,'')) similar to '%(payment|credit|refund|adjustment|receipt)%'),
        0
      ) as payments_total
      from public.transactions t
      where (
        t.lease_id in (select id from property_leases)
        or t.buildium_lease_id in (select buildium_lease_id from property_leases where buildium_lease_id is not null)
      )
        and t.date <= p_as_of
    ),
    payment_totals as (
      select
        case when pt.payments_total <> 0 then pt.payments_total else coalesce(plsum.total,0) end as payments_total,
        coalesce(pldep.total,0) as deposits_from_payments,
        coalesce(plpre.total,0) as prepayments_from_payments
      from payment_tx pt
      left join (
        select sum(total) as total from payment_lines where tx_id in (select unnest(deposit_tx_ids) from line_totals)
      ) pldep on true
      left join (
        select sum(total) as total from payment_lines where tx_id in (select unnest(prepay_tx_ids) from line_totals)
      ) plpre on true
      left join (
        select sum(total) as total from payment_lines
      ) plsum on true
    ),
    rolled as (
      select
        -- Prioritize bank lines when they exist - they represent actual bank account transactions
        -- Only fall back to payments_total if no bank lines exist at all
        -- This ensures cash balance reflects actual bank account balances, not just payment transactions
        case
          -- Always use bank_total if we have bank lines (they represent actual bank account balance)
          when lt.bank_line_count > 0 then lt.bank_total
          -- Fallback to payments_total only if no bank lines exist
          when pt.payments_total <> 0 then pt.payments_total
          -- Further fallbacks
          when lt.ar_fallback <> 0 then lt.ar_fallback
          else v_balance
        end as cash_balance_raw,
        case
          when pt.deposits_from_payments <> 0 then pt.deposits_from_payments
          when lt.deposit_total <> 0 then lt.deposit_total
          else v_deposits
        end as deposits_raw,
        case
          when pt.prepayments_from_payments <> 0 then pt.prepayments_from_payments
          when lt.prepay_total <> 0 then lt.prepay_total
          else v_prepay
        end as prepayments_raw,
        lt.bank_total as bank_total_complex,
        lt.bank_total_simple as bank_total_simple,
        pt.payments_total as payments_total_val,
        lt.ar_fallback as ar_fallback_val,
        lt.bank_line_count as bank_line_count,
        lt.bank_debits_total as bank_debits_total,
        lt.bank_credits_total as bank_credits_total,
        (lt.bank_line_count > 0 and abs(pt.payments_total) > 0 and abs(lt.bank_total) < abs(pt.payments_total) / 10) as incomplete_bank_lines_flag
      from line_totals lt, payment_totals pt
    )
    select jsonb_build_object(
      'cash_balance', r.cash_balance_raw,
      'security_deposits',
        (case when r.deposits_raw > 0 then -r.deposits_raw else r.deposits_raw end)
        + (case when r.prepayments_raw > 0 then -r.prepayments_raw else r.prepayments_raw end),
      'prepayments', r.prepayments_raw,
      'reserve', v_reserve,
      'available_balance',
        r.cash_balance_raw
        + (case when r.deposits_raw > 0 then -r.deposits_raw else r.deposits_raw end)
        + (case when r.prepayments_raw > 0 then -r.prepayments_raw else r.prepayments_raw end)
        - v_reserve,
      'as_of', p_as_of,
      '_debug'::text, jsonb_build_object(
        'bank_total_complex', r.bank_total_complex,
        'bank_total_simple', r.bank_total_simple,
        'payments_total', r.payments_total_val,
        'ar_fallback', r.ar_fallback_val,
        'used_fallback', v_balance,
        'bank_line_count', r.bank_line_count,
        'bank_debits_total', r.bank_debits_total,
        'bank_credits_total', r.bank_credits_total,
        'incomplete_bank_lines_flag', r.incomplete_bank_lines_flag
      )
    )
    into v_result
    from rolled r;
    
    return v_result;
end;
$$;

comment on function public.get_property_financials(uuid, date) is 
'Returns property financials with cash balance calculated from bank GL transaction_lines.
Only includes Rental entity type transactions to ensure property balances don''t include Company-level transactions.
Prioritizes bank account lines when they exist to ensure accurate cash balance.
Includes transaction_lines posted to property''s operating_bank_gl_account_id or deposit_trust_gl_account_id 
even if they don''t have property_id/unit_id/lease_id set, but only Rental entity type.';

-- ============================================================================
-- MIGRATION 4/4: Fix v_gl_account_balances_as_of
-- ============================================================================
-- Description: Fix v_gl_account_balances_as_of to filter property-scoped balances
-- ============================================================================

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

-- ============================================================================
-- ALL MIGRATIONS COMPLETE
-- ============================================================================
-- Verify by running:
-- SELECT COUNT(*) FROM transaction_lines WHERE account_entity_type IS NULL;
-- Should return 0
-- ============================================================================
