-- Migration: NYC Open Data integration config storage (org-scoped)
-- Stores dataset IDs, base URL, and encrypted app token per org for NYC Open Data / SODA access.

-- Safe drop of RLS policies if table exists (for reruns)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'nyc_open_data_integrations') THEN
        DROP POLICY IF EXISTS "nyc_open_data_integrations_org_read" ON public.nyc_open_data_integrations;
        DROP POLICY IF EXISTS "nyc_open_data_integrations_org_insert" ON public.nyc_open_data_integrations;
        DROP POLICY IF EXISTS "nyc_open_data_integrations_org_update" ON public.nyc_open_data_integrations;
        DROP POLICY IF EXISTS "nyc_open_data_integrations_org_delete" ON public.nyc_open_data_integrations;
        DROP POLICY IF EXISTS "nyc_open_data_integrations_service_role_full_access" ON public.nyc_open_data_integrations;
        DROP TRIGGER IF EXISTS trg_nyc_open_data_integrations_updated_at ON public.nyc_open_data_integrations;
    END IF;
END $$;

-- Create table
CREATE TABLE IF NOT EXISTS public.nyc_open_data_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    base_url TEXT NOT NULL DEFAULT 'https://data.cityofnewyork.us/',
    app_token_encrypted TEXT,
    dataset_elevator_devices TEXT NOT NULL DEFAULT 'ipu4-2q9a',
    dataset_elevator_inspections TEXT NOT NULL DEFAULT 'nu7n-tubp',
    dataset_elevator_violations TEXT NOT NULL DEFAULT 'ji82-zp9j',
    dataset_dob_violations TEXT NOT NULL DEFAULT '3h2n-5cm9',
    dataset_dob_active_violations TEXT NOT NULL DEFAULT '6drr-tyq2',
    dataset_dob_ecb_violations TEXT NOT NULL DEFAULT '6bgk-3dad',
    dataset_hpd_violations TEXT NOT NULL DEFAULT 'wvxf-dwi5',
    dataset_hpd_complaints TEXT NOT NULL DEFAULT 'ygpa-z7cr',
    dataset_fdny_violations TEXT NOT NULL DEFAULT 'avgm-ztsb',
    dataset_asbestos_violations TEXT NOT NULL DEFAULT 'r6c3-8mpt',
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS nyc_open_data_integrations_org_id_idx ON public.nyc_open_data_integrations(org_id);
CREATE INDEX IF NOT EXISTS nyc_open_data_integrations_is_enabled_idx ON public.nyc_open_data_integrations(is_enabled) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS nyc_open_data_integrations_deleted_at_idx ON public.nyc_open_data_integrations(deleted_at) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS nyc_open_data_integrations_org_id_unique ON public.nyc_open_data_integrations(org_id) WHERE deleted_at IS NULL;

-- Comments
COMMENT ON TABLE public.nyc_open_data_integrations IS 'Org-scoped NYC Open Data configuration (dataset IDs, base URL, app token encrypted at application layer).';
COMMENT ON COLUMN public.nyc_open_data_integrations.base_url IS 'SODA API base URL (defaults to https://data.cityofnewyork.us/).';
COMMENT ON COLUMN public.nyc_open_data_integrations.app_token_encrypted IS 'Encrypted Socrata app token (encrypted at application layer).';
COMMENT ON COLUMN public.nyc_open_data_integrations.dataset_elevator_devices IS 'Dataset ID for elevator devices (Open Data).';
COMMENT ON COLUMN public.nyc_open_data_integrations.dataset_elevator_inspections IS 'Dataset ID for elevator inspections/tests (Open Data).';
COMMENT ON COLUMN public.nyc_open_data_integrations.dataset_elevator_violations IS 'Dataset ID for elevator violations (Open Data).';
COMMENT ON COLUMN public.nyc_open_data_integrations.dataset_dob_violations IS 'Dataset ID for DOB violations (BIS).';
COMMENT ON COLUMN public.nyc_open_data_integrations.dataset_dob_active_violations IS 'Dataset ID for active DOB violations.';
COMMENT ON COLUMN public.nyc_open_data_integrations.dataset_dob_ecb_violations IS 'Dataset ID for DOB ECB/OATH violations.';
COMMENT ON COLUMN public.nyc_open_data_integrations.dataset_hpd_violations IS 'Dataset ID for HPD housing violations.';
COMMENT ON COLUMN public.nyc_open_data_integrations.dataset_hpd_complaints IS 'Dataset ID for HPD complaints/problems.';
COMMENT ON COLUMN public.nyc_open_data_integrations.dataset_fdny_violations IS 'Dataset ID for FDNY violations.';
COMMENT ON COLUMN public.nyc_open_data_integrations.dataset_asbestos_violations IS 'Dataset ID for DEP asbestos violations.';
COMMENT ON COLUMN public.nyc_open_data_integrations.is_enabled IS 'Whether NYC Open Data integration is enabled for this org.';

-- updated_at trigger
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
        CREATE TRIGGER trg_nyc_open_data_integrations_updated_at
            BEFORE UPDATE ON public.nyc_open_data_integrations
            FOR EACH ROW
            EXECUTE FUNCTION public.set_updated_at();
    END IF;
END $$;

-- RLS
ALTER TABLE public.nyc_open_data_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nyc_open_data_integrations_org_read"
    ON public.nyc_open_data_integrations FOR SELECT
    USING (public.is_org_member(auth.uid(), org_id));

CREATE POLICY "nyc_open_data_integrations_org_insert"
    ON public.nyc_open_data_integrations FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND public.is_org_member(auth.uid(), org_id));

CREATE POLICY "nyc_open_data_integrations_org_update"
    ON public.nyc_open_data_integrations FOR UPDATE
    USING (auth.uid() IS NOT NULL AND public.is_org_member(auth.uid(), org_id))
    WITH CHECK (auth.uid() IS NOT NULL AND public.is_org_member(auth.uid(), org_id));

CREATE POLICY "nyc_open_data_integrations_org_delete"
    ON public.nyc_open_data_integrations FOR DELETE
    USING (auth.uid() IS NOT NULL AND public.is_org_member(auth.uid(), org_id));

CREATE POLICY "nyc_open_data_integrations_service_role_full_access"
    ON public.nyc_open_data_integrations
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

COMMIT;
