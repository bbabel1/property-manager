begin;

-- Show one register row per bank-side transaction line (gl_accounts.is_bank_account = true).
-- This enables transfers (which often have TWO bank GL lines) to appear in BOTH bank accounts.
--
-- We keep a fallback row for legacy/ingested transactions that have transactions.bank_gl_account_id
-- set but are missing any bank-side transaction_lines.

create or replace view public.v_bank_register_transactions as
with bank_lines as (
  select
    tl.transaction_id,
    tl.gl_account_id,
    tl.amount,
    tl.posting_type
  from public.transaction_lines tl
  join public.gl_accounts ga
    on ga.id = tl.gl_account_id
   and ga.is_bank_account = true
)
select
  t.id,
  t.date,
  (coalesce(t.reference_number, t.check_number)::varchar(255)) as reference_number,
  t.memo,
  t.total_amount,
  t.transaction_type,
  t.vendor_id,
  bl.gl_account_id as bank_gl_account_id,
  bl.amount as bank_amount,
  bl.posting_type::varchar(10) as bank_posting_type,
  t.paid_by_label,
  t.paid_to_name
from public.transactions t
join bank_lines bl
  on bl.transaction_id = t.id

union all

select
  t.id,
  t.date,
  (coalesce(t.reference_number, t.check_number)::varchar(255)) as reference_number,
  t.memo,
  t.total_amount,
  t.transaction_type,
  t.vendor_id,
  t.bank_gl_account_id as bank_gl_account_id,
  null::numeric as bank_amount,
  null::varchar(10) as bank_posting_type,
  t.paid_by_label,
  t.paid_to_name
from public.transactions t
where t.bank_gl_account_id is not null
  and not exists (
    select 1
    from bank_lines bl
    where bl.transaction_id = t.id
  );

commit;


