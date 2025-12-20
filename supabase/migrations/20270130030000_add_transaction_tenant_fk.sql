-- Add tenant_id column to transactions to link payments to local tenants
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'transactions'
      AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.transactions ADD COLUMN tenant_id uuid NULL;
  END IF;
END $$;

-- Add foreign key if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'transactions_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Index for lookup/filtering by tenant
CREATE INDEX IF NOT EXISTS transactions_tenant_id_idx ON public.transactions(tenant_id);

-- Backfill tenant_id from payee_tenant_id using tenants.buildium_tenant_id
UPDATE public.transactions t
SET tenant_id = tn.id
FROM public.tenants tn
WHERE t.tenant_id IS NULL
  AND t.payee_tenant_id IS NOT NULL
  AND tn.buildium_tenant_id = t.payee_tenant_id;
