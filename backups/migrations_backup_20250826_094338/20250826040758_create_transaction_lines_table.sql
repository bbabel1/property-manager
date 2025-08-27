-- Migration: Create transaction_lines table
-- Description: Creates the 'transaction_lines' table with 18 fields to match remote
-- Author: Property Management System
-- Date: 2025-08-26

CREATE TABLE public.transaction_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES public.transactions(id),
    gl_account_id UUID,
    amount NUMERIC(10, 2) NOT NULL,
    memo TEXT,
    reference_number CHARACTER VARYING,
    line_type CHARACTER VARYING,
    is_debit BOOLEAN DEFAULT false,
    is_credit BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    buildium_transaction_line_id INTEGER,
    buildium_gl_account_id INTEGER,
    buildium_created_at TIMESTAMPTZ,
    buildium_updated_at TIMESTAMPTZ,
    property_id UUID REFERENCES public.properties(id),
    unit_id UUID REFERENCES public.units(id),
    lease_id BIGINT REFERENCES public.lease(id)
);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transaction_lines_updated_at ON public.transaction_lines;
CREATE TRIGGER trg_transaction_lines_updated_at
BEFORE UPDATE ON public.transaction_lines
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_transaction_lines_transaction_id ON public.transaction_lines(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_lines_gl_account_id ON public.transaction_lines(gl_account_id);
CREATE INDEX IF NOT EXISTS idx_transaction_lines_property_id ON public.transaction_lines(property_id);
CREATE INDEX IF NOT EXISTS idx_transaction_lines_unit_id ON public.transaction_lines(unit_id);
CREATE INDEX IF NOT EXISTS idx_transaction_lines_lease_id ON public.transaction_lines(lease_id);
CREATE INDEX IF NOT EXISTS idx_transaction_lines_buildium_id ON public.transaction_lines(buildium_transaction_line_id);
