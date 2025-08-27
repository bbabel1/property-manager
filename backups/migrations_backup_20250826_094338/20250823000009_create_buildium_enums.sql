-- Create Buildium-compatible enum types
-- Migration: 20250823000009_create_buildium_enums.sql
-- Description: Creates enum types for Buildium API integration

-- Property Types (Buildium PropertyType enum)
CREATE TYPE buildium_property_type AS ENUM (
  'Rental',
  'Association',
  'Commercial'
);

-- Unit Types (Buildium UnitType enum)
CREATE TYPE buildium_unit_type AS ENUM (
  'Apartment',
  'Condo',
  'House',
  'Townhouse',
  'Office',
  'Retail',
  'Warehouse',
  'Other'
);

-- Task Priority (Buildium TaskPriority enum)
CREATE TYPE buildium_task_priority AS ENUM (
  'Low',
  'Medium',
  'High',
  'Critical'
);

-- Task Status (Buildium TaskStatus enum)
CREATE TYPE buildium_task_status AS ENUM (
  'Open',
  'InProgress',
  'Completed',
  'Cancelled',
  'OnHold'
);

-- Bill Status (Buildium BillStatus enum)
CREATE TYPE buildium_bill_status AS ENUM (
  'Pending',
  'Paid',
  'Overdue',
  'Cancelled',
  'PartiallyPaid'
);

-- Payment Method (Buildium PaymentMethod enum)
CREATE TYPE buildium_payment_method AS ENUM (
  'Check',
  'Cash',
  'CreditCard',
  'BankTransfer',
  'OnlinePayment'
);

-- Vendor Category Types
CREATE TYPE buildium_vendor_category AS ENUM (
  'Contractor',
  'Maintenance',
  'Utilities',
  'Insurance',
  'Legal',
  'Accounting',
  'Marketing',
  'Other'
);

-- Bank Account Types (Buildium BankAccountType enum)
CREATE TYPE buildium_bank_account_type AS ENUM (
  'Checking',
  'Savings',
  'MoneyMarket',
  'CertificateOfDeposit'
);

-- Lease Status (Buildium LeaseStatus enum)
CREATE TYPE buildium_lease_status AS ENUM (
  'Future',
  'Active',
  'Past',
  'Cancelled'
);

-- Lease Contact Role (Buildium LeaseContactRole enum)
CREATE TYPE buildium_lease_contact_role AS ENUM (
  'Tenant',
  'Cosigner',
  'Guarantor'
);

-- Webhook Event Types
CREATE TYPE buildium_webhook_event_type AS ENUM (
  'PropertyCreated',
  'PropertyUpdated',
  'PropertyDeleted',
  'UnitCreated',
  'UnitUpdated',
  'UnitDeleted',
  'OwnerCreated',
  'OwnerUpdated',
  'OwnerDeleted',
  'LeaseCreated',
  'LeaseUpdated',
  'LeaseDeleted',
  'BillCreated',
  'BillUpdated',
  'BillPaid',
  'TaskCreated',
  'TaskUpdated',
  'TaskCompleted'
);

-- Sync Status Types
CREATE TYPE buildium_sync_status_type AS ENUM (
  'pending',
  'syncing',
  'synced',
  'failed',
  'conflict'
);

-- Add comments to document the enums
COMMENT ON TYPE buildium_property_type IS 'Buildium property types for API integration';
COMMENT ON TYPE buildium_unit_type IS 'Buildium unit types for API integration';
COMMENT ON TYPE buildium_task_priority IS 'Buildium task priority levels';
COMMENT ON TYPE buildium_task_status IS 'Buildium task status values';
COMMENT ON TYPE buildium_bill_status IS 'Buildium bill status values';
COMMENT ON TYPE buildium_payment_method IS 'Buildium payment method types';
COMMENT ON TYPE buildium_vendor_category IS 'Buildium vendor category types';
COMMENT ON TYPE buildium_bank_account_type IS 'Buildium bank account types';
COMMENT ON TYPE buildium_lease_status IS 'Buildium lease status values';
COMMENT ON TYPE buildium_lease_contact_role IS 'Buildium lease contact roles';
COMMENT ON TYPE buildium_webhook_event_type IS 'Buildium webhook event types';
COMMENT ON TYPE buildium_sync_status_type IS 'Buildium sync status values';

-- Log the migration completion
DO $$
BEGIN
    RAISE NOTICE 'Created Buildium-compatible enum types:';
    RAISE NOTICE '- buildium_property_type';
    RAISE NOTICE '- buildium_unit_type';
    RAISE NOTICE '- buildium_task_priority';
    RAISE NOTICE '- buildium_task_status';
    RAISE NOTICE '- buildium_bill_status';
    RAISE NOTICE '- buildium_payment_method';
    RAISE NOTICE '- buildium_vendor_category';
    RAISE NOTICE '- buildium_bank_account_type';
    RAISE NOTICE '- buildium_lease_status';
    RAISE NOTICE '- buildium_lease_contact_role';
    RAISE NOTICE '- buildium_webhook_event_type';
    RAISE NOTICE '- buildium_sync_status_type';
END $$;
