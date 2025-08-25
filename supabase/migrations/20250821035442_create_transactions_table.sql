-- Migration: Create Transactions Table
-- Date: 2025-08-21
-- Description: Create transactions table for financial data management

-- Create transaction_type_enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE transaction_type_enum AS ENUM ('Charge', 'Payment', 'Refund', 'ReversePayment', 'UnreversedPayment');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buildium_transaction_id INTEGER,
    Date DATE NOT NULL,
    TransactionType transaction_type_enum NOT NULL,
    TotalAmount NUMERIC NOT NULL,
    CheckNumber VARCHAR(50),
    PayeeTenantId INTEGER,
    PaymentMethod VARCHAR(50),
    Memo TEXT,
    buildium_bill_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    lease_id BIGINT,
    due_date DATE,
    vendor_id UUID,
    category_id UUID,
    reference_number VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending',
    is_recurring BOOLEAN DEFAULT false,
    recurring_schedule JSONB
);

-- Add comments
COMMENT ON TABLE transactions IS 'All financial transactions including bills, charges, credits, and payments. Use lease_id to connect to lease records. Bills and other property-level transactions may have lease_id = NULL.';
COMMENT ON COLUMN transactions.lease_id IS 'Reference to local lease record';
COMMENT ON COLUMN transactions.due_date IS 'Due date for bill transactions';
COMMENT ON COLUMN transactions.vendor_id IS 'Reference to vendor for bill transactions';
COMMENT ON COLUMN transactions.category_id IS 'Reference to bill category';
COMMENT ON COLUMN transactions.reference_number IS 'Reference number for bill transactions';
COMMENT ON COLUMN transactions.status IS 'Status of bill transaction (pending, paid, etc.)';
COMMENT ON COLUMN transactions.is_recurring IS 'Whether this is a recurring bill';
COMMENT ON COLUMN transactions.recurring_schedule IS 'JSON schedule for recurring bills';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(Date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(TransactionType);
CREATE INDEX IF NOT EXISTS idx_transactions_lease_id ON transactions(lease_id);
CREATE INDEX IF NOT EXISTS idx_transactions_buildium_id ON transactions(buildium_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transactions_buildium_bill_id ON transactions(buildium_bill_id);

-- Enable RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policy
CREATE POLICY "Allow all operations on transactions" ON transactions FOR ALL USING (true);
