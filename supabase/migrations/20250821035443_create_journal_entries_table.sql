-- Migration: Create Journal Entries Table
-- Date: 2025-08-21
-- Description: Create journal_entries table for transaction line items

-- Create journal_entries table
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    gl_account_id UUID,
    amount NUMERIC,
    memo TEXT,
    reference_number VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Add comments
COMMENT ON TABLE journal_entries IS 'Individual line items for transactions (transaction lines)';
COMMENT ON COLUMN journal_entries.transaction_id IS 'Reference to the parent transaction';
COMMENT ON COLUMN journal_entries.gl_account_id IS 'Reference to the GL account';
COMMENT ON COLUMN journal_entries.amount IS 'Amount for this journal entry line';
COMMENT ON COLUMN journal_entries.memo IS 'Memo for this line item';
COMMENT ON COLUMN journal_entries.reference_number IS 'Reference number for this line item';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_journal_entries_transaction_id ON journal_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_gl_account_id ON journal_entries(gl_account_id);

-- Enable RLS
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policy
CREATE POLICY "Allow all operations on journal_entries" ON journal_entries FOR ALL USING (true);
