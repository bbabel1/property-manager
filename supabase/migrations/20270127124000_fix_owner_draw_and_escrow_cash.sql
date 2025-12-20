-- Fix owner draw sign bug + backfill escrow single-line entries
-- Also ensures bank GL accounts are flagged correctly and refreshes cached property balances.

-- 1) Ensure any GL account referenced by bank_accounts is flagged as a bank account.
update public.gl_accounts ga
set is_bank_account = true
from public.bank_accounts ba
where ba.gl_account = ga.id
  and coalesce(ga.is_bank_account, false) = false;

-- 2) Correct historical owner draw journal entries that were written with reversed posting types.
-- Expected: Owner Draw = Debit, Bank GL = Credit.
with candidate_tx as (
  select tl.transaction_id
  from public.transaction_lines tl
  join public.gl_accounts ga on ga.id = tl.gl_account_id
  where tl.transaction_id is not null
  group by tl.transaction_id
  having
    bool_or(lower(coalesce(ga.name, '')) like '%owner draw%' and tl.posting_type = 'Credit')
    and bool_or(coalesce(ga.is_bank_account, false) = true and tl.posting_type = 'Debit')
)
update public.transaction_lines tl
set posting_type = case
    when lower(coalesce(ga.name, '')) like '%owner draw%' and tl.posting_type = 'Credit' then 'Debit'
    when coalesce(ga.is_bank_account, false) = true and tl.posting_type = 'Debit' then 'Credit'
    else tl.posting_type
  end,
  updated_at = now()
from public.gl_accounts ga
where tl.gl_account_id = ga.id
  and tl.transaction_id in (select transaction_id from candidate_tx)
  and (
    (lower(coalesce(ga.name, '')) like '%owner draw%' and tl.posting_type = 'Credit')
    or (coalesce(ga.is_bank_account, false) = true and tl.posting_type = 'Debit')
  );

-- 3) Backfill legacy escrow stage entries that inserted a single deposit-liability transaction_line
-- without a parent transaction or balancing bank line.
--
-- Strategy:
-- - Find deposit/security-deposit-liability lines where transaction_id is null and unit_id is present.
-- - Create a new GeneralJournalEntry transaction per line.
-- - Attach the existing line to the new transaction and populate property_id/org fields.
-- - Insert a balancing bank line to the property's deposit trust account (fallback to operating account).
with orphan as (
  select
    tl.id as line_id,
    gen_random_uuid() as new_transaction_id,
    tl.unit_id,
    u.property_id,
    p.org_id,
    p.buildium_property_id,
    u.buildium_unit_id,
    tl.date,
    tl.memo,
    abs(tl.amount) as amount,
    tl.posting_type as escrow_posting_type,
    coalesce(p.deposit_trust_account_id, p.operating_bank_account_id) as bank_account_id,
    ba.gl_account as bank_gl_account_id
  from public.transaction_lines tl
  join public.units u on u.id = tl.unit_id
  join public.properties p on p.id = u.property_id
  join public.gl_accounts ga on ga.id = tl.gl_account_id
  left join public.gl_account_category gac on gac.gl_account_id = ga.id
  left join public.bank_accounts ba
    on ba.id = coalesce(p.deposit_trust_account_id, p.operating_bank_account_id)
  where tl.transaction_id is null
    and tl.unit_id is not null
    and tl.amount is not null
    and (gac.category = 'deposit'::public.gl_category or coalesce(ga.is_security_deposit_liability, false) = true)
    and ba.gl_account is not null
    and abs(tl.amount) > 0
),
inserted_tx as (
  insert into public.transactions (
    id,
    date,
    memo,
    total_amount,
    transaction_type,
    status,
    org_id,
    monthly_log_id,
    bank_account_id,
    created_at,
    updated_at
  )
  select
    o.new_transaction_id,
    o.date,
    o.memo,
    o.amount,
    'GeneralJournalEntry',
    'Paid',
    o.org_id,
    ml.id as monthly_log_id,
    o.bank_account_id,
    now(),
    now()
  from orphan o
  left join public.monthly_logs ml
    on ml.unit_id = o.unit_id
    and ml.period_start = date_trunc('month', o.date)::date
  returning id
),
updated_lines as (
  update public.transaction_lines tl
  set
    transaction_id = o.new_transaction_id,
    property_id = coalesce(tl.property_id, o.property_id),
    account_entity_type = coalesce(tl.account_entity_type, 'Rental'::public.entity_type_enum),
    account_entity_id = coalesce(tl.account_entity_id, o.buildium_property_id),
    buildium_property_id = coalesce(tl.buildium_property_id, o.buildium_property_id),
    buildium_unit_id = coalesce(tl.buildium_unit_id, o.buildium_unit_id),
    updated_at = now()
  from orphan o
  where tl.id = o.line_id
  returning tl.transaction_id
)
insert into public.transaction_lines (
  transaction_id,
  gl_account_id,
  amount,
  posting_type,
  memo,
  account_entity_type,
  account_entity_id,
  date,
  created_at,
  updated_at,
  buildium_property_id,
  buildium_unit_id,
  property_id,
  unit_id
)
select
  o.new_transaction_id,
  o.bank_gl_account_id,
  o.amount,
  case when o.escrow_posting_type = 'Credit' then 'Debit' else 'Credit' end as posting_type,
  o.memo,
  'Rental'::public.entity_type_enum,
  o.buildium_property_id,
  o.date,
  now(),
  now(),
  o.buildium_property_id,
  o.buildium_unit_id,
  o.property_id,
  o.unit_id
from orphan o;

-- 4) Monitoring views: unbalanced transactions and transactions missing a bank line.
create or replace view public.unbalanced_transactions as
select
  tl.transaction_id,
  coalesce(sum(case when tl.posting_type = 'Debit' then abs(tl.amount) else 0 end), 0) as debit_total,
  coalesce(sum(case when tl.posting_type = 'Credit' then abs(tl.amount) else 0 end), 0) as credit_total,
  abs(
    coalesce(sum(case when tl.posting_type = 'Debit' then abs(tl.amount) else 0 end), 0) -
    coalesce(sum(case when tl.posting_type = 'Credit' then abs(tl.amount) else 0 end), 0)
  ) as diff
from public.transaction_lines tl
where tl.transaction_id is not null
group by tl.transaction_id
having abs(
  coalesce(sum(case when tl.posting_type = 'Debit' then abs(tl.amount) else 0 end), 0) -
  coalesce(sum(case when tl.posting_type = 'Credit' then abs(tl.amount) else 0 end), 0)
) > 0.01;

create or replace view public.transactions_missing_bank_line as
select
  tl.transaction_id
from public.transaction_lines tl
join public.gl_accounts ga on ga.id = tl.gl_account_id
where tl.transaction_id is not null
group by tl.transaction_id
having bool_or(coalesce(ga.is_bank_account, false)) is not true;

-- 5) Refresh cached property financials (cash_balance / security_deposits / available_balance).
do $$
declare r record;
begin
  for r in select id from public.properties loop
    perform public.fn_recalculate_property_financials(r.id);
  end loop;
end $$;

