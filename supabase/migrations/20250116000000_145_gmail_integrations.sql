-- Migration: Create gmail_integrations table for Staff Gmail OAuth integration
-- Purpose: Store Gmail OAuth tokens per staff user for sending Monthly Log Statements
-- Security: Tokens encrypted using pgcrypto before storage

BEGIN;

-- Create gmail_integrations table
-- Tokens are encrypted at application level before storage
CREATE TABLE IF NOT EXISTS public.gmail_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id BIGINT NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL CHECK (email ~* '^[^@]+@(gmail|googlemail)\.com$'),
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMPTZ NOT NULL,
    scope TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT gmail_integrations_staff_id_unique UNIQUE (staff_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS gmail_integrations_staff_id_idx ON public.gmail_integrations(staff_id);
CREATE INDEX IF NOT EXISTS gmail_integrations_user_id_idx ON public.gmail_integrations(user_id);
CREATE INDEX IF NOT EXISTS gmail_integrations_org_id_idx ON public.gmail_integrations(org_id);
CREATE INDEX IF NOT EXISTS gmail_integrations_is_active_idx ON public.gmail_integrations(is_active) WHERE is_active = true;

-- Comments
COMMENT ON TABLE public.gmail_integrations IS 'Gmail OAuth integrations for Staff users to send Monthly Log Statements';
COMMENT ON COLUMN public.gmail_integrations.access_token_encrypted IS 'Encrypted access token (encrypted at application level before storage)';
COMMENT ON COLUMN public.gmail_integrations.refresh_token_encrypted IS 'Encrypted refresh token (encrypted at application level, nullable if not provided by Google)';
COMMENT ON COLUMN public.gmail_integrations.email IS 'Gmail address (must be @gmail.com or @googlemail.com)';
COMMENT ON COLUMN public.gmail_integrations.org_id IS 'Organization ID for cross-org prevention';

-- Updated_at trigger
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
        DROP TRIGGER IF EXISTS trg_gmail_integrations_updated_at ON public.gmail_integrations;
        CREATE TRIGGER trg_gmail_integrations_updated_at
            BEFORE UPDATE ON public.gmail_integrations
            FOR EACH ROW
            EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

-- Trigger to auto-disable integration when staff is deactivated
CREATE OR REPLACE FUNCTION public.handle_staff_deactivation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.is_active = false AND OLD.is_active = true THEN
        UPDATE public.gmail_integrations
        SET is_active = false, updated_at = now()
        WHERE staff_id = NEW.id AND is_active = true;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gmail_integrations_staff_deactivation ON public.staff;
CREATE TRIGGER trg_gmail_integrations_staff_deactivation
    AFTER UPDATE OF is_active ON public.staff
    FOR EACH ROW
    WHEN (NEW.is_active = false AND OLD.is_active = true)
    EXECUTE FUNCTION public.handle_staff_deactivation();

-- RLS Policies
ALTER TABLE public.gmail_integrations ENABLE ROW LEVEL SECURITY;

-- Staff can only SELECT their own integration
CREATE POLICY "Staff can view own Gmail integration"
    ON public.gmail_integrations FOR SELECT
    USING (
        user_id = auth.uid() 
        AND EXISTS (
            SELECT 1 FROM public.staff 
            WHERE staff.id = gmail_integrations.staff_id 
            AND staff.user_id = auth.uid()
            AND staff.is_active = true
        )
    );

-- Staff can only UPDATE their own integration
CREATE POLICY "Staff can update own Gmail integration"
    ON public.gmail_integrations FOR UPDATE
    USING (
        user_id = auth.uid() 
        AND EXISTS (
            SELECT 1 FROM public.staff 
            WHERE staff.id = gmail_integrations.staff_id 
            AND staff.user_id = auth.uid()
            AND staff.is_active = true
        )
    );

-- Staff can only DELETE their own integration
CREATE POLICY "Staff can delete own Gmail integration"
    ON public.gmail_integrations FOR DELETE
    USING (
        user_id = auth.uid() 
        AND EXISTS (
            SELECT 1 FROM public.staff 
            WHERE staff.id = gmail_integrations.staff_id 
            AND staff.user_id = auth.uid()
        )
    );

-- Deny INSERT for regular users (only service role can insert)
CREATE POLICY "Deny INSERT for regular users"
    ON public.gmail_integrations FOR INSERT
    WITH CHECK (false);

-- Service role has full access
CREATE POLICY "Service role full access"
    ON public.gmail_integrations
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

COMMIT;

