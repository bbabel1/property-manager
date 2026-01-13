-- Enforce core invariants for transaction bookkeeping:
-- 1) Line amounts are non-negative (sign comes from posting_type + account type)
-- 2) Each Buildium transaction ID is unique per org
-- 3) Each Buildium bill ID has at most one Bill header per org

begin;

-- 1) Enforce non-negative amounts on transaction_lines
alter table public.transaction_lines
  add constraint transaction_lines_amount_nonnegative
  check (amount >= 0);

-- 2) Unique composite index for (org_id, buildium_transaction_id) where Buildium ID is present.
--    A separate unique constraint already exists on buildium_transaction_id alone; this index
--    aligns with common lookup patterns and makes the org scoping explicit.
create unique index if not exists idx_transactions_org_buildium_transaction_id
  on public.transactions (org_id, buildium_transaction_id)
  where buildium_transaction_id is not null;

-- 3) Ensure there is at most one Bill header per (org, buildium_bill_id).
--    Payments/checks referencing the same Buildium bill use the same buildium_bill_id but have
--    different transaction_type, so we scope uniqueness to Bills only.
create unique index if not exists idx_transactions_org_buildium_bill_id_bill_only
  on public.transactions (org_id, buildium_bill_id)
  where buildium_bill_id is not null
    and transaction_type = 'Bill'::public.transaction_type_enum;

commit;

