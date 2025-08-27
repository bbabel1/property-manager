-- Migration: Create gl_accounts table
-- Description: Creates the 'gl_accounts' table with 18 fields to match remote
-- Author: Property Management System
-- Date: 2025-08-26

CREATE TABLE public.gl_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buildium_gl_account_id INTEGER NOT NULL,
    account_number CHARACTER VARYING,
    name CHARACTER VARYING NOT NULL,
    description TEXT,
    type CHARACTER VARYING NOT NULL,
    sub_type CHARACTER VARYING,
    is_default_gl_account BOOLEAN,
    default_account_name CHARACTER VARYING,
    is_contra_account BOOLEAN,
    is_bank_account BOOLEAN,
    cash_flow_classification CHARACTER VARYING,
    exclude_from_cash_balances BOOLEAN,
    is_active BOOLEAN,
    parent_gl_account_id INTEGER,
    is_credit_card_account BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gl_accounts_updated_at ON public.gl_accounts;
CREATE TRIGGER trg_gl_accounts_updated_at
BEFORE UPDATE ON public.gl_accounts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_gl_accounts_buildium_id ON public.gl_accounts(buildium_gl_account_id);
CREATE INDEX IF NOT EXISTS idx_gl_accounts_type ON public.gl_accounts(type);
CREATE INDEX IF NOT EXISTS idx_gl_accounts_parent_id ON public.gl_accounts(parent_gl_account_id);
CREATE INDEX IF NOT EXISTS idx_gl_accounts_active ON public.gl_accounts(is_active);
