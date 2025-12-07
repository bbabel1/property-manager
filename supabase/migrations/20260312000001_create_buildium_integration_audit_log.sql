-- Migration: Create buildium_integration_audit_log table
-- Purpose: Audit all Buildium integration credential changes and actions
-- Security: Audit logs include masked secrets only, actor user ID, and action type

BEGIN;

-- Create buildium_integration_audit_log table
CREATE TABLE IF NOT EXISTS public.buildium_integration_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'ENABLE', 'DISABLE', 'TEST_CONNECTION')),
    field_changes JSONB,
    test_result TEXT CHECK (test_result IN ('success', 'auth_failed', 'network_error')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS buildium_integration_audit_log_org_id_idx ON public.buildium_integration_audit_log(org_id);
CREATE INDEX IF NOT EXISTS buildium_integration_audit_log_created_at_idx ON public.buildium_integration_audit_log(created_at);
CREATE INDEX IF NOT EXISTS buildium_integration_audit_log_actor_user_id_idx ON public.buildium_integration_audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS buildium_integration_audit_log_action_idx ON public.buildium_integration_audit_log(action);

-- Comments
COMMENT ON TABLE public.buildium_integration_audit_log IS 'Audit log for Buildium integration credential changes and actions. Secrets are masked in field_changes JSONB.';
COMMENT ON COLUMN public.buildium_integration_audit_log.field_changes IS 'JSONB object with masked secrets showing what fields changed (e.g., {"client_id": "cli_***123", "is_enabled": true})';
COMMENT ON COLUMN public.buildium_integration_audit_log.test_result IS 'Result of TEST_CONNECTION action (success, auth_failed, network_error)';
COMMENT ON COLUMN public.buildium_integration_audit_log.action IS 'Action type: INSERT, UPDATE, DELETE, ENABLE, DISABLE, TEST_CONNECTION';

-- RLS Policies
ALTER TABLE public.buildium_integration_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can SELECT audit logs for orgs they are members of
CREATE POLICY "buildium_integration_audit_log_org_read"
    ON public.buildium_integration_audit_log FOR SELECT
    USING (
        public.is_org_member(auth.uid(), org_id)
    );

-- Service role has full access
CREATE POLICY "buildium_integration_audit_log_service_role_full_access"
    ON public.buildium_integration_audit_log
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

COMMIT;

