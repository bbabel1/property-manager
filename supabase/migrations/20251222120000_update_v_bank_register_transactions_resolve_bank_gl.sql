begin;

-- Ensure the bank register can show all transactions that hit a bank GL account,
-- even when transactions.bank_gl_account_id was not populated during ingestion.
--
-- Rule: bank_gl_account_id_resolved = COALESCE(transactions.bank_gl_account_id, bank_line.gl_account_id)
-- Where bank_line is the "best" bank-side transaction line (ga.is_bank_account = true),
-- chosen deterministically by largest absolute amount then lowest line id.

create or replace view public.v_bank_register_transactions as
select
  t.id,
  t.date,
  (coalesce(t.reference_number, t.check_number)::varchar(255)) as reference_number,
  t.memo,
  t.total_amount,
  t.transaction_type,
  coalesce(t.bank_gl_account_id, bank_line.gl_account_id) as bank_gl_account_id,
  t.paid_by_label,
  t.paid_to_name
from public.transactions t
left join lateral (
  select tl.gl_account_id
  from public.transaction_lines tl
  join public.gl_accounts ga on ga.id = tl.gl_account_id and ga.is_bank_account = true
  where tl.transaction_id = t.id
  order by abs(coalesce(tl.amount, 0)) desc, tl.id asc
  limit 1
) bank_line on true;

commit;


