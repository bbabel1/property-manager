-- Deposit overlays: metadata + item linking on top of transactions

-- Deposit status lifecycle (no drafts yet)
DO $$
BEGIN
  CREATE TYPE public.deposit_status_enum AS ENUM ('posted', 'reconciled', 'voided');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

-- Thin overlay keyed to transactions; org_id included for tenancy + uniqueness
CREATE TABLE IF NOT EXISTS public.deposit_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  deposit_id text NOT NULL,
  status public.deposit_status_enum NOT NULL DEFAULT 'posted',
  buildium_deposit_id integer,
  buildium_sync_status text DEFAULT 'pending',
  buildium_sync_error text,
  buildium_last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  CONSTRAINT deposit_meta_transaction_unique UNIQUE (transaction_id)
);

COMMENT ON TABLE public.deposit_meta IS 'Deposit metadata overlay on transactions. Source of truth remains transactions table.';
COMMENT ON COLUMN public.deposit_meta.buildium_sync_status IS 'Sync status for Buildium operations: pending (not synced), synced (successfully synced), failed (sync error)';

-- Links deposits to their payment transactions
CREATE TABLE IF NOT EXISTS public.deposit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  payment_transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE RESTRICT,
  buildium_payment_transaction_id integer,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deposit_items_payment_unique UNIQUE (payment_transaction_id)
);

COMMENT ON TABLE public.deposit_items IS 'Links deposit transactions to payment transactions. Prevents double-depositing via unique constraints on payment_transaction_id and buildium_payment_transaction_id.';

-- Indexes for quick lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_deposit_meta_org_deposit_id ON public.deposit_meta(org_id, deposit_id);
CREATE INDEX IF NOT EXISTS idx_deposit_meta_transaction ON public.deposit_meta(transaction_id);
CREATE INDEX IF NOT EXISTS idx_deposit_meta_status ON public.deposit_meta(status);
CREATE INDEX IF NOT EXISTS idx_deposit_meta_sync_status ON public.deposit_meta(buildium_sync_status);
CREATE INDEX IF NOT EXISTS idx_deposit_meta_buildium_deposit ON public.deposit_meta(buildium_deposit_id) WHERE buildium_deposit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deposit_meta_org ON public.deposit_meta(org_id);

CREATE INDEX IF NOT EXISTS idx_deposit_items_deposit ON public.deposit_items(deposit_transaction_id);
CREATE INDEX IF NOT EXISTS idx_deposit_items_payment ON public.deposit_items(payment_transaction_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deposit_items_buildium_payment ON public.deposit_items(buildium_payment_transaction_id) WHERE buildium_payment_transaction_id IS NOT NULL;

-- Deterministic, org-scoped deposit ids with advisory lock to avoid race conditions
CREATE OR REPLACE FUNCTION public.generate_deposit_id(transaction_id_param uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  org_id_val uuid;
  year_str text;
  next_num integer;
  lock_key bigint;
BEGIN
  SELECT org_id INTO org_id_val
  FROM public.transactions
  WHERE id = transaction_id_param;

  IF org_id_val IS NULL THEN
    RAISE EXCEPTION 'Transaction not found or missing org_id: %', transaction_id_param;
  END IF;

  lock_key := hashtext(org_id_val::text)::bigint;
  PERFORM pg_advisory_xact_lock(lock_key);

  year_str := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(dm.deposit_id FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.deposit_meta dm
  WHERE dm.org_id = org_id_val
    AND dm.deposit_id LIKE 'DEP-' || year_str || '-%';

  RETURN 'DEP-' || year_str || '-' || LPAD(next_num::text, 3, '0');
END;
$$;

COMMENT ON FUNCTION public.generate_deposit_id(uuid) IS 'Generates deterministic deposit ID for a transaction. Protected against race conditions via advisory lock.';

-- Backfill existing deposits into overlay tables
INSERT INTO public.deposit_meta (
  transaction_id,
  org_id,
  deposit_id,
  status,
  buildium_deposit_id,
  buildium_sync_status,
  buildium_last_synced_at,
  created_at,
  updated_at
)
SELECT
  t.id,
  t.org_id,
  public.generate_deposit_id(t.id),
  'posted',
  t.buildium_transaction_id,
  CASE WHEN t.buildium_transaction_id IS NULL THEN 'pending' ELSE 'synced' END,
  CASE WHEN t.buildium_transaction_id IS NULL THEN NULL ELSE t.updated_at END,
  COALESCE(t.created_at, now()),
  COALESCE(t.updated_at, now())
FROM public.transactions t
WHERE t.transaction_type = 'Deposit'
  AND t.org_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.deposit_meta dm WHERE dm.transaction_id = t.id
  )
ORDER BY t.date, t.created_at, t.id;

WITH resolved_items AS (
  SELECT
    tpt.transaction_id AS deposit_transaction_id,
    pay.id AS payment_transaction_id,
    tpt.buildium_payment_transaction_id,
    ABS(COALESCE(NULLIF(tpt.amount, 0), pay.total_amount, 0))::numeric(14,2) AS amount,
    COALESCE(tpt.created_at, pay.created_at, now()) AS created_at,
    COALESCE(tpt.updated_at, pay.updated_at, now()) AS updated_at
  FROM public.transaction_payment_transactions tpt
  INNER JOIN public.transactions dep ON dep.id = tpt.transaction_id AND dep.transaction_type = 'Deposit'
  INNER JOIN public.transactions pay ON pay.buildium_transaction_id = tpt.buildium_payment_transaction_id
  WHERE tpt.buildium_payment_transaction_id IS NOT NULL
)
INSERT INTO public.deposit_items (
  deposit_transaction_id,
  payment_transaction_id,
  buildium_payment_transaction_id,
  amount,
  created_at,
  updated_at
)
SELECT
  r.deposit_transaction_id,
  r.payment_transaction_id,
  r.buildium_payment_transaction_id,
  r.amount,
  r.created_at,
  r.updated_at
FROM resolved_items r
WHERE r.amount IS NOT NULL
  AND r.amount > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.deposit_items di
    WHERE di.deposit_transaction_id = r.deposit_transaction_id
      AND di.payment_transaction_id = r.payment_transaction_id
  );

-- RLS: org-scoped via parent transaction org membership
ALTER TABLE public.deposit_meta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deposit_meta_org_read" ON public.deposit_meta;
CREATE POLICY "deposit_meta_org_read"
ON public.deposit_meta
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.id = deposit_meta.transaction_id
      AND t.org_id = deposit_meta.org_id
      AND public.is_org_member((SELECT auth.uid()), t.org_id)
  )
);

DROP POLICY IF EXISTS "deposit_meta_org_insert" ON public.deposit_meta;
CREATE POLICY "deposit_meta_org_insert"
ON public.deposit_meta
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.id = deposit_meta.transaction_id
      AND t.org_id = deposit_meta.org_id
      AND public.is_org_admin_or_manager((SELECT auth.uid()), t.org_id)
  )
);

DROP POLICY IF EXISTS "deposit_meta_org_update" ON public.deposit_meta;
CREATE POLICY "deposit_meta_org_update"
ON public.deposit_meta
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.id = deposit_meta.transaction_id
      AND t.org_id = deposit_meta.org_id
      AND public.is_org_admin_or_manager((SELECT auth.uid()), t.org_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.id = deposit_meta.transaction_id
      AND t.org_id = deposit_meta.org_id
      AND public.is_org_admin_or_manager((SELECT auth.uid()), t.org_id)
  )
);

DROP POLICY IF EXISTS "deposit_meta_org_delete" ON public.deposit_meta;
CREATE POLICY "deposit_meta_org_delete"
ON public.deposit_meta
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.id = deposit_meta.transaction_id
      AND t.org_id = deposit_meta.org_id
      AND public.is_org_admin_or_manager((SELECT auth.uid()), t.org_id)
  )
);

ALTER TABLE public.deposit_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deposit_items_org_read" ON public.deposit_items;
CREATE POLICY "deposit_items_org_read"
ON public.deposit_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.id = deposit_items.deposit_transaction_id
      AND public.is_org_member((SELECT auth.uid()), t.org_id)
  )
);

DROP POLICY IF EXISTS "deposit_items_org_insert" ON public.deposit_items;
CREATE POLICY "deposit_items_org_insert"
ON public.deposit_items
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.id = deposit_items.deposit_transaction_id
      AND public.is_org_admin_or_manager((SELECT auth.uid()), t.org_id)
      AND EXISTS (
        SELECT 1 FROM public.transactions p
        WHERE p.id = deposit_items.payment_transaction_id
          AND p.org_id = t.org_id
      )
  )
);

DROP POLICY IF EXISTS "deposit_items_org_update" ON public.deposit_items;
CREATE POLICY "deposit_items_org_update"
ON public.deposit_items
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.id = deposit_items.deposit_transaction_id
      AND public.is_org_admin_or_manager((SELECT auth.uid()), t.org_id)
      AND EXISTS (
        SELECT 1 FROM public.transactions p
        WHERE p.id = deposit_items.payment_transaction_id
          AND p.org_id = t.org_id
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.id = deposit_items.deposit_transaction_id
      AND public.is_org_admin_or_manager((SELECT auth.uid()), t.org_id)
      AND EXISTS (
        SELECT 1 FROM public.transactions p
        WHERE p.id = deposit_items.payment_transaction_id
          AND p.org_id = t.org_id
      )
  )
);

DROP POLICY IF EXISTS "deposit_items_org_delete" ON public.deposit_items;
CREATE POLICY "deposit_items_org_delete"
ON public.deposit_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.id = deposit_items.deposit_transaction_id
      AND public.is_org_admin_or_manager((SELECT auth.uid()), t.org_id)
  )
);
