-- Migration: Create buildium_integrations table for org-level Buildium credential management
-- Purpose: Store encrypted Buildium API credentials per organization
-- Security: Credentials encrypted using application-level encryption before storage
-- Encryption key source: GMAIL_TOKEN_ENCRYPTION_KEY or NEXTAUTH_SECRET environment variable
-- Rotation path: On encryption key change, existing encrypted credentials become invalid and must be re-entered

BEGIN;

-- Pre-flight: Deduplicate existing rows per org (if any) before adding unique constraint
-- Keep latest created_at or updated_at per org
DO $$
DECLARE
    dup_record RECORD;
BEGIN
    -- Check if table already exists (for idempotency)
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'buildium_integrations') THEN
        -- Find duplicates and keep the one with latest updated_at or created_at
        FOR dup_record IN
            SELECT org_id, COUNT(*) as cnt
            FROM public.buildium_integrations
            WHERE deleted_at IS NULL
            GROUP BY org_id
            HAVING COUNT(*) > 1
        LOOP
            -- Delete all but the one with latest timestamp
            DELETE FROM public.buildium_integrations
            WHERE org_id = dup_record.org_id
              AND deleted_at IS NULL
              AND id NOT IN (
                  SELECT id
                  FROM public.buildium_integrations
                  WHERE org_id = dup_record.org_id
                    AND deleted_at IS NULL
                  ORDER BY COALESCE(updated_at, created_at) DESC
                  LIMIT 1
              );
        END LOOP;
    END IF;
END $$;

-- Create buildium_integrations table
-- Credentials are encrypted at application level before storage
CREATE TABLE IF NOT EXISTS public.buildium_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id_encrypted TEXT NOT NULL,
    client_secret_encrypted TEXT NOT NULL,
    base_url TEXT NOT NULL,
    webhook_secret_encrypted TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    last_tested_at TIMESTAMPTZ,
    webhook_secret_rotated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT buildium_integrations_base_url_check CHECK (
        -- Validate base_url against allowlist
        -- Handles URLs with/without protocol, trailing slashes, query strings
        base_url ~* '^https?://(apisandbox|api)\.buildium\.com'
        OR base_url ~* '^(apisandbox|api)\.buildium\.com'
    )
);

-- Indexes
CREATE INDEX IF NOT EXISTS buildium_integrations_org_id_idx ON public.buildium_integrations(org_id);
CREATE INDEX IF NOT EXISTS buildium_integrations_is_enabled_idx ON public.buildium_integrations(is_enabled) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS buildium_integrations_deleted_at_idx ON public.buildium_integrations(deleted_at) WHERE deleted_at IS NULL;

-- Partial unique index for org_id (one active integration per org)
CREATE UNIQUE INDEX IF NOT EXISTS buildium_integrations_org_id_unique ON public.buildium_integrations(org_id) WHERE deleted_at IS NULL;

-- Comments
COMMENT ON TABLE public.buildium_integrations IS 'Buildium API credentials per organization. Credentials encrypted at application level before storage.';
COMMENT ON COLUMN public.buildium_integrations.client_id_encrypted IS 'Encrypted Buildium Client ID (encrypted at application level before storage)';
COMMENT ON COLUMN public.buildium_integrations.client_secret_encrypted IS 'Encrypted Buildium Client Secret (encrypted at application level before storage)';
COMMENT ON COLUMN public.buildium_integrations.webhook_secret_encrypted IS 'Encrypted Buildium Webhook Secret (encrypted at application level before storage)';
COMMENT ON COLUMN public.buildium_integrations.base_url IS 'Buildium API base URL (must be apisandbox.buildium.com or api.buildium.com)';
COMMENT ON COLUMN public.buildium_integrations.is_enabled IS 'Whether Buildium integration is enabled for this organization';
COMMENT ON COLUMN public.buildium_integrations.deleted_at IS 'Soft delete timestamp (null if active)';
COMMENT ON COLUMN public.buildium_integrations.last_tested_at IS 'Timestamp of last successful API connection test';
COMMENT ON COLUMN public.buildium_integrations.webhook_secret_rotated_at IS 'Timestamp when webhook secret was last rotated';
COMMENT ON COLUMN public.buildium_integrations.org_id IS 'Organization ID (one integration per org)';

-- Encryption key source and rotation path documentation
COMMENT ON TABLE public.buildium_integrations IS 'Buildium API credentials per organization. Encryption key source: GMAIL_TOKEN_ENCRYPTION_KEY or NEXTAUTH_SECRET environment variable. On encryption key change, existing encrypted credentials become invalid and must be re-entered through the UI.';

-- Updated_at trigger
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
        DROP TRIGGER IF EXISTS trg_buildium_integrations_updated_at ON public.buildium_integrations;
        CREATE TRIGGER trg_buildium_integrations_updated_at
            BEFORE UPDATE ON public.buildium_integrations
            FOR EACH ROW
            EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

-- RLS Policies
ALTER TABLE public.buildium_integrations ENABLE ROW LEVEL SECURITY;

-- Users can SELECT integrations for orgs they are members of
CREATE POLICY "buildium_integrations_org_read"
    ON public.buildium_integrations FOR SELECT
    USING (
        public.is_org_member(auth.uid(), org_id)
    );

-- Users can INSERT integrations for orgs they are members of AND authenticated
CREATE POLICY "buildium_integrations_org_insert"
    ON public.buildium_integrations FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND public.is_org_member(auth.uid(), org_id)
    );

-- Users can UPDATE integrations for orgs they are members of AND authenticated
CREATE POLICY "buildium_integrations_org_update"
    ON public.buildium_integrations FOR UPDATE
    USING (
        auth.uid() IS NOT NULL
        AND public.is_org_member(auth.uid(), org_id)
    )
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND public.is_org_member(auth.uid(), org_id)
    );

-- Users can DELETE (soft delete) integrations for orgs they are members of AND authenticated
CREATE POLICY "buildium_integrations_org_delete"
    ON public.buildium_integrations FOR DELETE
    USING (
        auth.uid() IS NOT NULL
        AND public.is_org_member(auth.uid(), org_id)
    );

-- Service role has full access
CREATE POLICY "buildium_integrations_service_role_full_access"
    ON public.buildium_integrations
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

COMMIT;

