# Atomic Posting RPC: `post_transaction`

This RPC creates a transaction header and its lines atomically, reusing existing database primitives for double-entry validation and locking.

- **Migration:** `supabase/migrations/20290415121000_create_post_transaction_rpc.sql`
- **Function:** `public.post_transaction(p_header jsonb, p_lines jsonb, p_idempotency_key text default null, p_validate_balance boolean default true) returns uuid`

## Behavior

- If `p_idempotency_key` is provided and already exists on `transactions.idempotency_key`, returns the existing transaction id without changing lines.
- Builds the header via `jsonb_populate_record` into the `transactions` composite type, filling defaults when missing:
  - `id` → `gen_random_uuid()`
  - `idempotency_key` → `p_idempotency_key` if passed
  - `created_at` / `updated_at` → `now()`
  - `date` → `current_date`
- Inserts the header, returning the new `transaction.id`.
- Calls `replace_transaction_lines(id, p_lines, p_validate_balance)`:
  - Locks the transaction row
  - Deletes existing lines
  - Inserts provided lines (expects `p_lines` to be a JSON array)
  - Runs `validate_transaction_balance` when `p_validate_balance` is true
- Raises on any error (implicit rollback).

## Inputs

- `p_header` (jsonb): JSON representation of the `transactions` row. Supply required fields (e.g., `org_id`, `transaction_type`, `status`, `total_amount`, `date` if specific). Optional `idempotency_key` is overridden by `p_idempotency_key` when passed.
- `p_lines` (jsonb): JSON array of line objects accepted by `replace_transaction_lines` (includes `gl_account_id`, `amount`, `posting_type`, optional `memo`, `property_id`, `unit_id`, `lease_id`, etc.).
- `p_idempotency_key` (text, optional): Idempotency guard; unique partial index enforced on `transactions`.
- `p_validate_balance` (boolean, default true): When true, enforces balanced debits/credits via `validate_transaction_balance`.

## Notes

- The migration also ensures `transactions.idempotency_key` exists with a partial unique index.
- `p_lines` must be a JSON array; otherwise the RPC raises `22023`.
- The function is `SECURITY DEFINER` and sets `search_path = public`. RLS on `transactions`/`transaction_lines` is bypassed; guard access at the API layer.
