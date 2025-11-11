-- Migration: Add pdf_url to monthly_logs table
-- Purpose: Store public URL of generated monthly statement PDF
ALTER TABLE monthly_logs
ADD COLUMN IF NOT EXISTS pdf_url TEXT;
COMMENT ON COLUMN monthly_logs.pdf_url IS 'Public URL of generated monthly statement PDF stored in Supabase storage or other cloud storage';
-- Add index for queries that check if PDF exists