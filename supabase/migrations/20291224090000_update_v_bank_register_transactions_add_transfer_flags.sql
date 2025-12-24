begin;

-- Add transfer detection fields to the bank register view.
-- We keep the existing "single bank line" behavior (via lateral join) and add:
-- - is_transfer: true when a second bank-account line exists for the transaction
-- - transfer_other_bank_gl_account_id: the other bank account involved in the transfer
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
  t.paid_to_name,
  t.paid_to_type,
  t.paid_to_buildium_id,
  t.payee_name,
  t.payee_buildium_type,
  t.payee_buildium_id,
  case
    when bank_line.gl_account_id is null then false
    when exists (
      select 1
      from public.transaction_lines tl2
      join public.gl_accounts ga2 on ga2.id = tl2.gl_account_id and ga2.is_bank_account = true
      where tl2.transaction_id = t.id
        and tl2.gl_account_id <> bank_line.gl_account_id
    ) then true
    else false
  end as is_transfer,
  (
    select tl2.gl_account_id
    from public.transaction_lines tl2
    join public.gl_accounts ga2 on ga2.id = tl2.gl_account_id and ga2.is_bank_account = true
    where tl2.transaction_id = t.id
      and tl2.gl_account_id <> bank_line.gl_account_id
    order by tl2.id asc
    limit 1
  ) as transfer_other_bank_gl_account_id
from public.transactions t
left join lateral (
  select tl.gl_account_id, tl.amount, tl.posting_type
  from public.transaction_lines tl
  join public.gl_accounts ga on ga.id = tl.gl_account_id and ga.is_bank_account = true
  where tl.transaction_id = t.id
  order by
    abs(coalesce(tl.amount, 0)) desc,
    case when tl.posting_type = 'Credit' then 0 else 1 end,
    tl.id asc
  limit 1
) bank_line on true;

commit;


