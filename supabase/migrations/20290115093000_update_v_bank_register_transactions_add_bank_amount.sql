begin;

-- Expose the bank-side amount and posting type for register rows so the UI
-- can show Payment/Deposit columns even when transactions.total_amount is 0.
-- Drop and recreate to avoid column position conflicts.
drop view if exists public.v_bank_register_transactions;

create view public.v_bank_register_transactions as
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
  order by abs(coalesce(tl.amount, 0)) desc, tl.id asc
  limit 1
) bank_line on true;

commit;
