-- Normalize transaction_lines posting_type values and enforce consistent formatting
-- Also ensure amounts are stored as absolute values with sign carried by posting_type

begin;

-- Backfill existing rows to the canonical vocabulary
update public.transaction_lines
set posting_type = case
    when upper(coalesce(posting_type, '')) in ('DEBIT', 'DR') then 'Debit'
    when upper(coalesce(posting_type, '')) in ('CREDIT', 'CR') then 'Credit'
    else posting_type
  end,
    amount = abs(coalesce(amount, 0));

-- Normalize future writes
create or replace function public.trg_normalize_transaction_line()
returns trigger
language plpgsql
as $$
begin
  new.posting_type := case
    when upper(coalesce(new.posting_type, '')) in ('DEBIT', 'DR') then 'Debit'
    when upper(coalesce(new.posting_type, '')) in ('CREDIT', 'CR') then 'Credit'
    else new.posting_type
  end;

  if new.amount is not null then
    new.amount := abs(new.amount);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_normalize_transaction_line on public.transaction_lines;
create trigger trg_normalize_transaction_line
before insert or update on public.transaction_lines
for each row
execute function public.trg_normalize_transaction_line();

-- Recompute header totals from normalized lines
update public.transactions t
set total_amount = public.fn_calculate_transaction_total(t.id)
where exists (
  select 1
  from public.transaction_lines tl
  where tl.transaction_id = t.id
);

commit;
