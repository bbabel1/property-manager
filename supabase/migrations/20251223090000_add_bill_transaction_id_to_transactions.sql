begin;

-- Add a local reference for bill-backed payments/checks so UI can link bills without using Buildium IDs.
-- Buildium IDs should only be used inside Buildium sync/webhook flows.

alter table public.transactions
  add column if not exists bill_transaction_id uuid references public.transactions(id) on delete set null;

comment on column public.transactions.bill_transaction_id is
  'Local FK to the Bill (transactions.id) this payment/check was applied to. Populated by Buildium webhook/sync handlers.';

-- Best-effort backfill for existing data: link payments/checks to bills using the shared buildium_bill_id.
update public.transactions p
set bill_transaction_id = b.id
from public.transactions b
where p.bill_transaction_id is null
  and p.buildium_bill_id is not null
  and b.buildium_bill_id = p.buildium_bill_id
  and b.transaction_type = 'Bill'
  and p.transaction_type in ('Payment', 'Check');

-- Keep vendor_id consistent for bill-backed payments/checks (local-only propagation).
update public.transactions p
set vendor_id = b.vendor_id
from public.transactions b
where p.vendor_id is null
  and p.bill_transaction_id = b.id
  and b.transaction_type = 'Bill';

commit;


