begin;

create or replace view public.v_bank_register_transactions as
select
  t.id,
  t.date,
  t.reference_number,
  t.memo,
  t.total_amount,
  t.transaction_type,
  t.bank_gl_account_id,
  coalesce(t.paid_by_label, '—') as paid_by_label,
  coalesce(t.paid_to_name, '—') as paid_to_name
from public.transactions t;

commit;

