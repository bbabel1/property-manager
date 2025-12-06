-- Link transactions to work orders
alter table public.transactions
  add column if not exists work_order_id uuid references public.work_orders(id) on delete set null;

create index if not exists idx_transactions_work_order_id on public.transactions(work_order_id);
