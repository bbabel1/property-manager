-- Adds an enum-backed status column for transactions and normalizes existing values
begin;
-- Create the enum type
create type transaction_status_enum as enum (
  '',
  'Overdue',
  'Due',
  'Partially paid',
  'Paid',
  'Cancelled'
);
-- Drop dependent views first
drop view if exists public.v_recent_transactions_ranked;
-- Remove default from status column
alter table public.transactions
alter column status drop default;
-- Update existing values to match enum values
update public.transactions
set status = case
    when status is null then ''
    when lower(status) in ('overdue') then 'Overdue'
    when lower(status) in ('pending', 'due') then 'Due'
    when lower(status) in (
      'partiallypaid',
      'partially_paid',
      'partially paid'
    ) then 'Partially paid'
    when lower(status) = 'paid' then 'Paid'
    when lower(status) = 'cancelled' then 'Cancelled'
    else ''
  end;
-- Change column type to enum
alter table public.transactions
alter column status type transaction_status_enum using status::transaction_status_enum;
-- Set default and not null constraints
alter table public.transactions
alter column status
set default '';
alter table public.transactions
alter column status
set not null;
-- Recreate the dropped view
create or replace view public.v_recent_transactions_ranked as
select t.*,
  row_number() over (
    partition by t.org_id
    order by t.date desc,
      t.created_at desc
  ) as rn
from public.transactions t;
commit;