-- Sync enumerated types to match remote database exactly
-- Based on the remote database enum images provided

-- First, drop all existing enums to start fresh
-- Note: We need to drop them in dependency order (tables that use them first)

-- Drop enums that might be used by tables
DROP TYPE IF EXISTS bedroom_enum CASCADE;
DROP TYPE IF EXISTS bathroom_enum CASCADE;
DROP TYPE IF EXISTS unit_status_enum CASCADE;
DROP TYPE IF EXISTS appliance_type_enum CASCADE;
DROP TYPE IF EXISTS inspection_status_enum CASCADE;
DROP TYPE IF EXISTS inspection_type_enum CASCADE;
DROP TYPE IF EXISTS rent_cycle_enum CASCADE;
DROP TYPE IF EXISTS entity_type_enum CASCADE;
DROP TYPE IF EXISTS lease_contact_role_enum CASCADE;
DROP TYPE IF EXISTS lease_contact_status_enum CASCADE;
DROP TYPE IF EXISTS "ServicePlan" CASCADE;
DROP TYPE IF EXISTS "FeeFrequency" CASCADE;
DROP TYPE IF EXISTS "FeeType" CASCADE;
DROP TYPE IF EXISTS etf_account_type_enum CASCADE;
DROP TYPE IF EXISTS property_status CASCADE;
DROP TYPE IF EXISTS buildium_property_type CASCADE;
DROP TYPE IF EXISTS buildium_unit_type CASCADE;
DROP TYPE IF EXISTS buildium_task_priority CASCADE;
DROP TYPE IF EXISTS buildium_task_status CASCADE;
DROP TYPE IF EXISTS buildium_bill_status CASCADE;
DROP TYPE IF EXISTS buildium_payment_method CASCADE;
DROP TYPE IF EXISTS buildium_vendor_category CASCADE;
DROP TYPE IF EXISTS buildium_bank_account_type CASCADE;
DROP TYPE IF EXISTS buildium_lease_status CASCADE;
DROP TYPE IF EXISTS buildium_lease_contact_role CASCADE;
DROP TYPE IF EXISTS buildium_webhook_event_type CASCADE;
DROP TYPE IF EXISTS buildium_sync_status_type CASCADE;
DROP TYPE IF EXISTS transaction_type_enum CASCADE;

-- Create all enums from the first image
CREATE TYPE bedroom_enum AS ENUM (
    'Studio', '1', '2', '3', '4', '5+', '6', '7', '8', '9+'
);

CREATE TYPE bathroom_enum AS ENUM (
    '1', '1.5', '2', '2.5', '3', '3.5', '4+', '4.5', '5', '5+'
);

CREATE TYPE unit_status_enum AS ENUM (
    'Occupied', 'Vacant', 'Inactive'
);

CREATE TYPE appliance_type_enum AS ENUM (
    'Refrigerator', 'Freezer', 'Stove', 'Microwave', 'Dishwasher', 'Washer/Dryer'
);

CREATE TYPE inspection_status_enum AS ENUM (
    'Scheduled', 'Completed'
);

CREATE TYPE inspection_type_enum AS ENUM (
    'Periodic', 'Move-In', 'Move-Out'
);

CREATE TYPE rent_cycle_enum AS ENUM (
    'Monthly', 'Weekly', 'Every2Weeks', 'Quarterly', 'Yearly', 'Every2Months', 'Daily', 'Every6Months'
);

CREATE TYPE entity_type_enum AS ENUM (
    'Rental', 'Company'
);

CREATE TYPE lease_contact_role_enum AS ENUM (
    'Tenant', 'Cosigner'
);

CREATE TYPE lease_contact_status_enum AS ENUM (
    'Future', 'Active', 'Past'
);

CREATE TYPE "ServicePlan" AS ENUM (
    'Full', 'Basic', 'A-la-carte'
);

CREATE TYPE "FeeFrequency" AS ENUM (
    'Monthly', 'Annually'
);

CREATE TYPE "FeeType" AS ENUM (
    'Percentage', 'Flat Rate'
);

CREATE TYPE etf_account_type_enum AS ENUM (
    'Checking', 'Saving'
);

CREATE TYPE property_status AS ENUM (
    'Active', 'Inactive'
);

CREATE TYPE buildium_property_type AS ENUM (
    'Rental', 'Association', 'Commercial'
);

CREATE TYPE buildium_unit_type AS ENUM (
    'Apartment', 'Condo', 'House', 'Townhouse', 'Office', 'Retail', 'Warehouse', 'Other'
);

CREATE TYPE buildium_task_priority AS ENUM (
    'Low', 'Medium', 'High', 'Critical'
);

CREATE TYPE buildium_task_status AS ENUM (
    'Open', 'InProgress', 'Completed', 'Cancelled', 'OnHold'
);

-- Create all enums from the second image
CREATE TYPE buildium_bill_status AS ENUM (
    'Pending', 'Paid', 'Overdue', 'Cancelled', 'PartiallyPaid'
);

CREATE TYPE buildium_payment_method AS ENUM (
    'Check', 'Cash', 'CreditCard', 'BankTransfer', 'OnlinePayment'
);

CREATE TYPE buildium_vendor_category AS ENUM (
    'Contractor', 'Maintenance', 'Utilities', 'Insurance', 'Legal', 'Accounting', 'Marketing', 'Other'
);

CREATE TYPE buildium_bank_account_type AS ENUM (
    'Checking', 'Savings', 'MoneyMarket', 'CertificateOfDeposit'
);

CREATE TYPE buildium_lease_status AS ENUM (
    'Future', 'Active', 'Past', 'Cancelled'
);

CREATE TYPE buildium_lease_contact_role AS ENUM (
    'Tenant', 'Cosigner', 'Guarantor'
);

CREATE TYPE buildium_webhook_event_type AS ENUM (
    'PropertyCreated', 'PropertyUpdated', 'PropertyDeleted', 
    'UnitCreated', 'UnitUpdated', 'UnitDeleted', 
    'OwnerCreated', 'OwnerUpdated', 'OwnerDeleted', 
    'LeaseCreated', 'LeaseUpdated', 'LeaseDeleted', 
    'BillCreated', 'BillUpdated', 'BillPaid', 
    'TaskCreated', 'TaskUpdated', 'TaskCompleted'
);

CREATE TYPE buildium_sync_status_type AS ENUM (
    'pending', 'syncing', 'synced', 'failed', 'conflict'
);

CREATE TYPE transaction_type_enum AS ENUM (
    'Bill', 'Charge', 'Credit', 'Payment'
);
