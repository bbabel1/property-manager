-- Migration: Create statement_emails audit log table
-- Purpose: Track all monthly statement email sends for audit and debugging
CREATE TABLE IF NOT EXISTS statement_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monthly_log_id UUID NOT NULL REFERENCES monthly_logs(id) ON DELETE CASCADE,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_by_user_id UUID REFERENCES auth.users(id) ON DELETE
    SET NULL,
        recipients JSONB NOT NULL,
        -- [{email, name, status: "sent"|"failed"}]
        pdf_url TEXT,
        email_provider_id TEXT,
        -- Resend message ID or other provider ID
        status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced')),
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_statement_emails_monthly_log_id ON statement_emails(monthly_log_id);
CREATE INDEX IF NOT EXISTS idx_statement_emails_sent_at ON statement_emails(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_statement_emails_status ON statement_emails(status);
CREATE INDEX IF NOT EXISTS idx_statement_emails_sent_by_user ON statement_emails(sent_by_user_id);
-- Comments for documentation
COMMENT ON TABLE statement_emails IS 'Audit log for monthly statement email sends via Resend or other email providers';
COMMENT ON COLUMN statement_emails.recipients IS 'JSONB array of recipient objects with delivery status. Example: [{"email":"owner@example.com","name":"John Doe","status":"sent"}]';