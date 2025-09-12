-- Period GL account activity scoped to a property
create or replace function public.gl_account_activity(
  p_property_id uuid,
  p_from date,
  p_to   date,
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
  join public.gl_accounts ga on ga.id = tl.gl_account_id
  where tl.property_id = p_property_id
    and tl.date >= p_from
    and tl.date <  (p_to + 1)
    and (p_gl_account_ids is null or tl.gl_account_id = any(p_gl_account_ids))
  group by ga.id, ga.name
  order by ga.name;
$$;

-- Helpful indexes for fast range scans by property
create index if not exists tl_prop_date_idx
  on public.transaction_lines (property_id, date);

create index if not exists tl_prop_gl_date_idx
  on public.transaction_lines (property_id, gl_account_id, date);

