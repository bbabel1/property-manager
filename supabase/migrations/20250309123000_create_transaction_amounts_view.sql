-- Ensure environments missing the transaction_amounts helper still have a compatible view
-- used by monthly_log_transaction_bundle and related fallbacks.
create or replace view public.transaction_amounts as
with picked_lines as (
  select
    t.id as transaction_id,
    tl.amount,
    tl.posting_type,
    tl.unit_id,
    tl.created_at,
    ga.name,
    ga.account_number,
    gac.category,
    row_number() over (
      partition by t.id
      order by
        case
          when gac.category = 'deposit'::public.gl_category
            or lower(coalesce(ga.name, '')) like '%tax escrow%'
          then 0
          else 1
        end,
        tl.created_at asc,
        tl.id asc
    ) as rn
  from public.transactions t
  left join public.transaction_lines tl on tl.transaction_id = t.id
  left join public.gl_accounts ga on ga.id = tl.gl_account_id
  left join public.gl_account_category gac on gac.gl_account_id = ga.id
)
select
  t.id,
  t.transaction_type,
  t.memo,
  t.date,
  t.lease_id,
  t.monthly_log_id,
  t.reference_number,
  t.created_at,
  case
    when lower(coalesce(pl.posting_type, '')) = 'credit'
      and (pl.category = 'deposit'::public.gl_category
        or lower(coalesce(pl.name, '')) like '%tax escrow%')
      then -abs(pl.amount)
    when lower(coalesce(pl.posting_type, '')) = 'debit'
      and (pl.category = 'deposit'::public.gl_category
        or lower(coalesce(pl.name, '')) like '%tax escrow%')
      then abs(pl.amount)
    else abs(coalesce(pl.amount, t.total_amount, 0))
  end as effective_amount,
  coalesce(pl.name, pl.account_number) as account_name
from public.transactions t
left join picked_lines pl
  on pl.transaction_id = t.id
  and pl.rn = 1;
