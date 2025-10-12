-- Adds an enum-backed status column for transactions and normalizes existing values
begin;

create type transaction_status_enum as enum ('', 'Overdue', 'Due', 'Partially paid', 'Paid', 'Cancelled');

alter table public.transactions
  alter column status drop default;

update public.transactions
set status = case
  when status is null then ''
  when lower(status) in ('overdue') then 'Overdue'
  when lower(status) in ('pending', 'due') then 'Due'
  when lower(status) in ('partiallypaid', 'partially_paid', 'partially paid') then 'Partially paid'
  when lower(status) = 'paid' then 'Paid'
  when lower(status) = 'cancelled' then 'Cancelled'
  else ''
end;

alter table public.transactions
  alter column status type transaction_status_enum
  using status::transaction_status_enum;

alter table public.transactions
  alter column status set default '';

alter table public.transactions
  alter column status set not null;

commit;
