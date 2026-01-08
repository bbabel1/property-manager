-- Extend GL reporting for property/unit scope and cash-basis variants

begin;

-- Property + optional unit scoped account activity
create or replace function public.gl_account_activity(
  p_property_id uuid,
  p_from date,
  p_to   date,
  p_unit_id uuid default null,
  p_gl_account_ids uuid[] default null
) returns table (
  gl_account_id uuid,
  gl_account_name text,
  debits numeric(14,2),
  credits numeric(14,2),
  net numeric(14,2)
)
language sql
security invoker
stable
as $$
  select
    ga.id,
    ga.name,
    coalesce(sum(case when tl.posting_type = 'Debit' then tl.amount else 0 end), 0)::numeric(14,2)  as debits,
    coalesce(sum(case when tl.posting_type = 'Credit' then tl.amount else 0 end), 0)::numeric(14,2) as credits,
    coalesce(sum(case when tl.posting_type = 'Debit' then tl.amount else 0 end)
           - sum(case when tl.posting_type = 'Credit' then tl.amount else 0 end), 0)::numeric(14,2) as net
  from public.transaction_lines tl
  join public.transactions t on t.id = tl.transaction_id
  join public.gl_accounts ga on ga.id = tl.gl_account_id
  where t.property_id = p_property_id
    and (p_unit_id is null or t.unit_id = p_unit_id)
    and tl.date >= p_from
    and tl.date <  (p_to + 1)
    and (p_gl_account_ids is null or tl.gl_account_id = any(p_gl_account_ids))
  group by ga.id, ga.name
  order by ga.name;
$$;

-- Cash-basis variant (filters on is_cash_posting)
create or replace function public.gl_account_activity_cash_basis(
  p_property_id uuid,
  p_from date,
  p_to   date,
  p_unit_id uuid default null,
  p_gl_account_ids uuid[] default null
) returns table (
  gl_account_id uuid,
  gl_account_name text,
  debits numeric(14,2),
  credits numeric(14,2),
  net numeric(14,2)
)
language sql
security invoker
stable
as $$
  select
    ga.id,
    ga.name,
    coalesce(sum(case when tl.posting_type = 'Debit' then tl.amount else 0 end), 0)::numeric(14,2)  as debits,
    coalesce(sum(case when tl.posting_type = 'Credit' then tl.amount else 0 end), 0)::numeric(14,2) as credits,
    coalesce(sum(case when tl.posting_type = 'Debit' then tl.amount else 0 end)
           - sum(case when tl.posting_type = 'Credit' then tl.amount else 0 end), 0)::numeric(14,2) as net
  from public.transaction_lines tl
  join public.transactions t on t.id = tl.transaction_id
  join public.gl_accounts ga on ga.id = tl.gl_account_id
  where t.property_id = p_property_id
    and (p_unit_id is null or t.unit_id = p_unit_id)
    and tl.date >= p_from
    and tl.date <  (p_to + 1)
    and tl.is_cash_posting is true
    and (p_gl_account_ids is null or tl.gl_account_id = any(p_gl_account_ids))
  group by ga.id, ga.name
  order by ga.name;
$$;

-- Ledger balance with optional unit filter and reconciliation cutoff
create or replace function public.gl_ledger_balance_as_of(
  p_property_id uuid,
  p_gl_account_id uuid,
  p_as_of date,
  p_unit_id uuid default null,
  p_exclude_unreconciled boolean default false
) returns numeric
language sql
security invoker
stable
as $$
  with latest_recon as (
    select max(statement_ending_date) as max_date
    from public.reconciliation_log rl
    where rl.property_id = p_property_id
      and rl.gl_account_id = p_gl_account_id
  )
  select coalesce(sum(case when tl.posting_type='Debit' then tl.amount
                           when tl.posting_type='Credit' then -tl.amount
                           else 0 end),0)::numeric(14,2)
  from public.transaction_lines tl
  join public.transactions t on t.id = tl.transaction_id
  left join latest_recon lr on true
  where t.property_id = p_property_id
    and (p_unit_id is null or t.unit_id = p_unit_id)
    and tl.gl_account_id = p_gl_account_id
    and tl.date <= p_as_of
    and (
      not p_exclude_unreconciled
      or (lr.max_date is not null and tl.date <= lr.max_date)
    );
$$;

-- Trial balance with optional property/unit filters
create or replace function public.gl_trial_balance_as_of(
  p_as_of_date date,
  p_property_id uuid default null,
  p_unit_id uuid default null
) returns table(
  gl_account_id uuid,
  buildium_gl_account_id integer,
  account_number text,
  name text,
  type text,
  sub_type text,
  debits numeric,
  credits numeric,
  balance numeric
) as $$
  select 
    ga.id,
    ga.buildium_gl_account_id,
    ga.account_number,
    ga.name,
    ga.type,
    ga.sub_type,
    coalesce(sum(case when tl.posting_type = 'Debit' then tl.amount else 0 end), 0)::numeric as debits,
    coalesce(sum(case when tl.posting_type = 'Credit' then tl.amount else 0 end), 0)::numeric as credits,
    (coalesce(sum(case when tl.posting_type = 'Debit' then tl.amount else 0 end), 0) -
     coalesce(sum(case when tl.posting_type = 'Credit' then tl.amount else 0 end), 0))::numeric as balance
  from public.gl_accounts ga
  left join public.transaction_lines tl 
    on tl.gl_account_id = ga.id 
   and tl.date <= p_as_of_date
  left join public.transactions t on t.id = tl.transaction_id
    and (p_property_id is null or t.property_id = p_property_id)
    and (p_unit_id is null or t.unit_id = p_unit_id)
  group by ga.id, ga.buildium_gl_account_id, ga.account_number, ga.name, ga.type, ga.sub_type
  order by ga.account_number nulls first, ga.name;
$$ language sql stable security invoker;

-- Helper indexes (if not already present)
create index if not exists idx_transaction_lines_date on public.transaction_lines(date);

commit;
