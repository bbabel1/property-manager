-- Remove any enumerated types that are not in the remote database images
-- Based on the remote database enum images provided

-- List of enums that SHOULD exist (from the images)
-- First image enums:
-- bedroom_enum, bathroom_enum, unit_status_enum, appliance_type_enum, 
-- inspection_status_enum, inspection_type_enum, rent_cycle_enum, entity_type_enum,
-- lease_contact_role_enum, lease_contact_status_enum, ServicePlan, FeeFrequency,
-- FeeType, etf_account_type_enum, property_status, buildium_property_type,
-- buildium_unit_type, buildium_task_priority, buildium_task_status

-- Second image enums:
-- buildium_bill_status, buildium_payment_method, buildium_vendor_category,
-- buildium_bank_account_type, buildium_lease_status, buildium_lease_contact_role,
-- buildium_webhook_event_type, buildium_sync_status_type, transaction_type_enum

-- Drop any enums that are NOT in the above list
-- We'll use a more targeted approach to avoid dropping the ones we want to keep

-- Check for and drop any enums that might have been created by other migrations
-- but are not in the remote database images

-- Common extra enums that might exist:
DROP TYPE IF EXISTS buildium_lease_contact_role_enum CASCADE; -- This was renamed to buildium_lease_contact_role
DROP TYPE IF EXISTS buildium_lease_status_enum CASCADE; -- This was renamed to buildium_lease_status
DROP TYPE IF EXISTS buildium_bank_account_type_enum CASCADE; -- This was renamed to buildium_bank_account_type
DROP TYPE IF EXISTS buildium_vendor_category_enum CASCADE; -- This was renamed to buildium_vendor_category
DROP TYPE IF EXISTS buildium_bill_status_enum CASCADE; -- This was renamed to buildium_bill_status
DROP TYPE IF EXISTS buildium_payment_method_enum CASCADE; -- This was renamed to buildium_payment_method
DROP TYPE IF EXISTS buildium_webhook_event_type_enum CASCADE; -- This was renamed to buildium_webhook_event_type
DROP TYPE IF EXISTS buildium_sync_status_type_enum CASCADE; -- This was renamed to buildium_sync_status_type

-- Drop any other potential extra enums that might exist
DROP TYPE IF EXISTS buildium_owner_type CASCADE;
DROP TYPE IF EXISTS buildium_tenant_type CASCADE;
DROP TYPE IF EXISTS buildium_property_sub_type CASCADE;
DROP TYPE IF EXISTS buildium_unit_sub_type CASCADE;
DROP TYPE IF EXISTS buildium_task_category CASCADE;
DROP TYPE IF EXISTS buildium_work_order_status CASCADE;
DROP TYPE IF EXISTS buildium_work_order_priority CASCADE;
DROP TYPE IF EXISTS buildium_work_order_type CASCADE;
DROP TYPE IF EXISTS buildium_bill_category CASCADE;
DROP TYPE IF EXISTS buildium_payment_status CASCADE;
DROP TYPE IF EXISTS buildium_transaction_type CASCADE;
DROP TYPE IF EXISTS buildium_journal_entry_type CASCADE;
DROP TYPE IF EXISTS buildium_gl_account_type CASCADE;
DROP TYPE IF EXISTS buildium_gl_account_category CASCADE;
DROP TYPE IF EXISTS buildium_contact_type CASCADE;
DROP TYPE IF EXISTS buildium_contact_role CASCADE;
DROP TYPE IF EXISTS buildium_contact_status CASCADE;
DROP TYPE IF EXISTS buildium_owner_status CASCADE;
DROP TYPE IF EXISTS buildium_tenant_status CASCADE;
DROP TYPE IF EXISTS buildium_property_status_enum CASCADE;
DROP TYPE IF EXISTS buildium_unit_status_enum CASCADE;
DROP TYPE IF EXISTS buildium_owner_status_enum CASCADE;
DROP TYPE IF EXISTS buildium_tenant_status_enum CASCADE;
DROP TYPE IF EXISTS buildium_contact_status_enum CASCADE;
DROP TYPE IF EXISTS buildium_contact_role_enum CASCADE;
DROP TYPE IF EXISTS buildium_contact_type_enum CASCADE;
DROP TYPE IF EXISTS buildium_gl_account_type_enum CASCADE;
DROP TYPE IF EXISTS buildium_gl_account_category_enum CASCADE;
DROP TYPE IF EXISTS buildium_journal_entry_type_enum CASCADE;
DROP TYPE IF EXISTS buildium_transaction_type_enum CASCADE;
DROP TYPE IF EXISTS buildium_payment_status_enum CASCADE;
DROP TYPE IF EXISTS buildium_bill_category_enum CASCADE;
DROP TYPE IF EXISTS buildium_work_order_type_enum CASCADE;
DROP TYPE IF EXISTS buildium_work_order_priority_enum CASCADE;
DROP TYPE IF EXISTS buildium_work_order_status_enum CASCADE;
DROP TYPE IF EXISTS buildium_task_category_enum CASCADE;
DROP TYPE IF EXISTS buildium_unit_sub_type_enum CASCADE;
DROP TYPE IF EXISTS buildium_property_sub_type_enum CASCADE;
DROP TYPE IF EXISTS buildium_tenant_type_enum CASCADE;
DROP TYPE IF EXISTS buildium_owner_type_enum CASCADE;
