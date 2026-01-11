-- Recurring bills: Add constraints and indexes for namespaced JSONB approach
-- This migration supports Option B (namespaced JSONB) from the plan

BEGIN;

-- Ensure idempotency_key column exists (may already exist from previous migrations)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Create unique index on idempotency_key if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_idempotency_key
  ON public.transactions(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Add unique constraint on (parent_transaction_id, instance_date) for child bills
-- This prevents duplicate bill generation using JSONB path expressions
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_recurring_instance
  ON public.transactions(
    (recurring_schedule->'instance'->>'parent_transaction_id'),
    (recurring_schedule->'instance'->>'instance_date')
  )
  WHERE is_recurring = false
    AND recurring_schedule->'instance'->>'parent_transaction_id' IS NOT NULL
    AND recurring_schedule->'instance'->>'instance_date' IS NOT NULL;

-- Index for querying recurring bills (parent bills with active schedules)
CREATE INDEX IF NOT EXISTS idx_transactions_is_recurring
  ON public.transactions(is_recurring)
  WHERE is_recurring = true
    AND transaction_type = 'Bill';

-- Index for finding children of a parent bill
CREATE INDEX IF NOT EXISTS idx_transactions_parent_recurring
  ON public.transactions((recurring_schedule->'instance'->>'parent_transaction_id'))
  WHERE is_recurring = false
    AND transaction_type = 'Bill'
    AND recurring_schedule->'instance'->>'parent_transaction_id' IS NOT NULL;

-- GIN index for querying recurring_schedule JSONB fields (for schedule queries)
CREATE INDEX IF NOT EXISTS idx_transactions_recurring_schedule_gin
  ON public.transactions USING gin(recurring_schedule)
  WHERE is_recurring = true
    AND recurring_schedule IS NOT NULL;

COMMENT ON INDEX idx_transactions_recurring_instance IS
  'Prevents duplicate bill generation by enforcing uniqueness on (parent_transaction_id, instance_date) for child bills';

COMMENT ON INDEX idx_transactions_is_recurring IS
  'Performance index for querying recurring parent bills';

COMMENT ON INDEX idx_transactions_parent_recurring IS
  'Performance index for finding child bills by parent transaction ID';

COMMENT ON INDEX idx_transactions_recurring_schedule_gin IS
  'GIN index for efficient JSONB queries on recurring_schedule field';

-- Advisory lock helpers for recurring bills generation (similar to compliance lock pattern)
CREATE OR REPLACE FUNCTION public.acquire_recurring_bills_lock(lock_key text)
RETURNS boolean
LANGUAGE sql
AS $$
  SELECT pg_try_advisory_lock(hashtext(lock_key));
$$;
COMMENT ON FUNCTION public.acquire_recurring_bills_lock IS 'Attempts to take an advisory lock for recurring bills generation; returns true when acquired';

CREATE OR REPLACE FUNCTION public.release_recurring_bills_lock(lock_key text)
RETURNS boolean
LANGUAGE sql
AS $$
  SELECT pg_advisory_unlock(hashtext(lock_key));
$$;
COMMENT ON FUNCTION public.release_recurring_bills_lock IS 'Releases an advisory lock for recurring bills generation; returns true when unlocked';

COMMIT;

