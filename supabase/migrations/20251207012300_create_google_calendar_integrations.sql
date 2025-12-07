-- Migration: Create google_calendar_integrations table for Staff Google Calendar OAuth integration
-- Purpose: Store Google Calendar OAuth tokens per staff user for reading/writing calendar events
-- Security: Tokens encrypted using application-level encryption before storage

BEGIN;

-- Create google_calendar_integrations table
-- Tokens are encrypted at application level before storage
CREATE TABLE IF NOT EXISTS public.google_calendar_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id BIGINT NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL CHECK (email ~* '^[^@\\s]+@[^@\\s]+$'),
    calendar_id TEXT NOT NULL DEFAULT 'primary',
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMPTZ NOT NULL,
    scope TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT google_calendar_integrations_staff_org_unique UNIQUE (staff_id, org_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS google_calendar_integrations_staff_id_idx ON public.google_calendar_integrations(staff_id);
CREATE INDEX IF NOT EXISTS google_calendar_integrations_user_id_idx ON public.google_calendar_integrations(user_id);
CREATE INDEX IF NOT EXISTS google_calendar_integrations_org_id_idx ON public.google_calendar_integrations(org_id);
CREATE INDEX IF NOT EXISTS google_calendar_integrations_is_active_idx ON public.google_calendar_integrations(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS google_calendar_integrations_email_idx ON public.google_calendar_integrations(email);
CREATE INDEX IF NOT EXISTS google_calendar_integrations_calendar_id_idx ON public.google_calendar_integrations(calendar_id);

-- Comments
COMMENT ON TABLE public.google_calendar_integrations IS 'Google Calendar OAuth integrations for Staff users to read/write calendar events';
COMMENT ON COLUMN public.google_calendar_integrations.access_token_encrypted IS 'Encrypted access token (encrypted at application level before storage)';
COMMENT ON COLUMN public.google_calendar_integrations.refresh_token_encrypted IS 'Encrypted refresh token (encrypted at application level, nullable if not provided by Google)';
COMMENT ON COLUMN public.google_calendar_integrations.email IS 'Google account email (Google Workspace allowed)';
COMMENT ON COLUMN public.google_calendar_integrations.calendar_id IS 'Calendar ID (typically "primary" for user''s main calendar)';
COMMENT ON COLUMN public.google_calendar_integrations.org_id IS 'Organization ID for multi-tenant isolation';

-- Updated_at trigger
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
        DROP TRIGGER IF EXISTS trg_google_calendar_integrations_updated_at ON public.google_calendar_integrations;
        CREATE TRIGGER trg_google_calendar_integrations_updated_at
            BEFORE UPDATE ON public.google_calendar_integrations
            FOR EACH ROW
            EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

-- Trigger to auto-disable integration when staff is deactivated
CREATE OR REPLACE FUNCTION public.handle_calendar_integration_staff_deactivation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.is_active = false AND OLD.is_active = true THEN
        UPDATE public.google_calendar_integrations
        SET is_active = false, updated_at = now()
        WHERE staff_id = NEW.id AND is_active = true;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_google_calendar_integrations_staff_deactivation ON public.staff;
CREATE TRIGGER trg_google_calendar_integrations_staff_deactivation
    AFTER UPDATE OF is_active ON public.staff
    FOR EACH ROW
    WHEN (NEW.is_active = false AND OLD.is_active = true)
    EXECUTE FUNCTION public.handle_calendar_integration_staff_deactivation();

-- RLS Policies
ALTER TABLE public.google_calendar_integrations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Staff can view own Calendar integration" ON public.google_calendar_integrations;
DROP POLICY IF EXISTS "Staff can update own Calendar integration" ON public.google_calendar_integrations;
DROP POLICY IF EXISTS "Staff can delete own Calendar integration" ON public.google_calendar_integrations;
DROP POLICY IF EXISTS "Deny INSERT for regular users" ON public.google_calendar_integrations;
DROP POLICY IF EXISTS "Service role full access" ON public.google_calendar_integrations;

-- Staff can SELECT their own integration within their org
CREATE POLICY "Staff can view own Calendar integration"
    ON public.google_calendar_integrations FOR SELECT
    USING (
        user_id = (select auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.org_memberships m
            WHERE m.user_id = (select auth.uid())
            AND m.org_id = google_calendar_integrations.org_id
        )
        AND EXISTS (
            SELECT 1 FROM public.staff 
            WHERE staff.id = google_calendar_integrations.staff_id 
            AND staff.user_id = (select auth.uid())
            AND staff.is_active = true
        )
    );

-- Staff can UPDATE their own integration within their org
CREATE POLICY "Staff can update own Calendar integration"
    ON public.google_calendar_integrations FOR UPDATE
    USING (
        user_id = (select auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.org_memberships m
            WHERE m.user_id = (select auth.uid())
            AND m.org_id = google_calendar_integrations.org_id
        )
        AND EXISTS (
            SELECT 1 FROM public.staff 
            WHERE staff.id = google_calendar_integrations.staff_id 
            AND staff.user_id = (select auth.uid())
            AND staff.is_active = true
        )
    );

-- Staff can DELETE their own integration within their org
CREATE POLICY "Staff can delete own Calendar integration"
    ON public.google_calendar_integrations FOR DELETE
    USING (
        user_id = (select auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.org_memberships m
            WHERE m.user_id = (select auth.uid())
            AND m.org_id = google_calendar_integrations.org_id
        )
    );

-- Deny INSERT for regular users (only service role can insert)
CREATE POLICY "Deny INSERT for regular users"
    ON public.google_calendar_integrations FOR INSERT
    WITH CHECK (false);

-- Service role has full access
CREATE POLICY "Service role full access"
    ON public.google_calendar_integrations
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

COMMIT;

