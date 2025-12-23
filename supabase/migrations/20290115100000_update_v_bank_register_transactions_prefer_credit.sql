begin;

-- Prefer bank credits when multiple bank lines share the same absolute amount
-- so outflow transactions (payments/transfers) surface in the Payment column
-- instead of Deposit.
create or replace view public.v_bank_register_transactions as
select
  t.id,
  t.date,
  (coalesce(t.reference_number, t.check_number)::varchar(255)) as reference_number,
  t.memo,
  t.total_amount,
  t.transaction_type,
  t.vendor_id,
  coalesce(t.bank_gl_account_id, bank_line.gl_account_id) as bank_gl_account_id,
  bank_line.amount as bank_amount,
  bank_line.posting_type as bank_posting_type,
  t.paid_by_label,
  t.paid_to_name
from public.transactions t
left join lateral (
  select tl.gl_account_id, tl.amount, tl.posting_type
  from public.transaction_lines tl
  join public.gl_accounts ga on ga.id = tl.gl_account_id and ga.is_bank_account = true
  where tl.transaction_id = t.id
  order by abs(coalesce(tl.amount, 0)) desc, case when tl.posting_type = 'Credit' then 0 else 1 end, tl.id asc
  limit 1
) bank_line on true;

commit;
