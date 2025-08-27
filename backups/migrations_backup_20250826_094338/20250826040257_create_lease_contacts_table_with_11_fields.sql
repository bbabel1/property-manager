-- Migration: Create lease_contacts table to match remote database
-- Description: Creates the 'lease_contacts' table with 11 fields to match remote exactly
-- Author: Property Management System
-- Date: 2025-08-26

CREATE TABLE public.lease_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lease_id BIGINT NOT NULL REFERENCES public.lease(id),
    tenant_id BIGINT NOT NULL REFERENCES public.contacts(id),
    role CHARACTER VARYING NOT NULL,
    status CHARACTER VARYING NOT NULL,
    move_in_date DATE,
    is_rent_responsible BOOLEAN,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    move_out_date DATE,
    notice_given_date DATE
);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lease_contacts_updated_at ON public.lease_contacts;
CREATE TRIGGER trg_lease_contacts_updated_at
BEFORE UPDATE ON public.lease_contacts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_lease_contacts_lease_id ON public.lease_contacts(lease_id);
CREATE INDEX IF NOT EXISTS idx_lease_contacts_tenant_id ON public.lease_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lease_contacts_role ON public.lease_contacts(role);
CREATE INDEX IF NOT EXISTS idx_lease_contacts_status ON public.lease_contacts(status);
CREATE INDEX IF NOT EXISTS idx_lease_contacts_dates ON public.lease_contacts(move_in_date, move_out_date);
