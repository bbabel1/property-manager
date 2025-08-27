# Database Schema Documentation

> Generated on: 2025-01-15T17:33:36.080Z
>
> This documentation is automatically generated from your database schema files.

## Overview

This document describes the database schema for the Property Management System
with comprehensive Buildium API integration support.

## Core Tables

### Properties

- **id** (UUID, Primary Key) - Unique identifier

- **name** (VARCHAR(127)) - Property name

- **structure_description** (TEXT) - Property description

- **address_line1** (VARCHAR(100)) - Primary address line

- **address_line2** (VARCHAR(100)) - Secondary address line

- **address_line3** (VARCHAR(100)) - Tertiary address line

- **city** (VARCHAR(100)) - City

- **state** (VARCHAR(100)) - State

- **postal_code** (VARCHAR(20)) - Postal code

- **country** (VARCHAR(100)) - Country

- **buildium_property_id** (INTEGER) - Buildium API property ID

- **rental_sub_type** (VARCHAR(50)) - Property type classification

- **rental_owner_ids** (INTEGER[]) - Array of owner IDs

- **operating_bank_account_id** (UUID) - Operating bank account reference

- **reserve** (NUMERIC) - Reserve amount

- **year_built** (INTEGER) - Year property was built

- **status** (VARCHAR(20)) - Property status (Active/Inactive)

- **total_units** (INTEGER) - Total number of units

- **property_type** (VARCHAR(100)) - Buildium property type

- **square_footage** (INTEGER) - Total square footage

- **bedrooms** (INTEGER) - Number of bedrooms

- **bathrooms** (DECIMAL(3,1)) - Number of bathrooms

- **is_active** (BOOLEAN) - Active status in Buildium

- **buildium_created_at** (TIMESTAMP WITH TIME ZONE) - Buildium creation timestamp

- **buildium_updated_at** (TIMESTAMP WITH TIME ZONE) - Buildium update timestamp

- **created_at** (TIMESTAMP WITH TIME ZONE) - Local creation timestamp

- **updated_at** (TIMESTAMP WITH TIME ZONE) - Local update timestamp

### Units

- **id** (UUID, Primary Key) - Unique identifier

- **property_id** (UUID) - Property reference

- **unit_number** (VARCHAR(30)) - Unit number

- **unit_size** (INTEGER) - Unit size

- **market_rent** (NUMERIC) - Market rent amount

- **address_line1** (VARCHAR(100)) - Unit address line 1

- **address_line2** (VARCHAR(100)) - Unit address line 2

- **address_line3** (VARCHAR(100)) - Unit address line 3

- **city** (VARCHAR(100)) - City

- **state** (VARCHAR(100)) - State

- **postal_code** (VARCHAR(20)) - Postal code

- **country** (VARCHAR(100)) - Country

- **unit_bedrooms** (VARCHAR(20)) - Number of bedrooms

- **unit_bathrooms** (VARCHAR(20)) - Number of bathrooms

- **description** (TEXT) - Unit description

- **buildium_unit_id** (INTEGER) - Buildium API unit ID

- **unit_type** (VARCHAR(50)) - Buildium unit type

- **square_footage** (INTEGER) - Unit square footage

- **is_active** (BOOLEAN) - Active status in Buildium

- **buildium_created_at** (TIMESTAMP WITH TIME ZONE) - Buildium creation timestamp

- **buildium_updated_at** (TIMESTAMP WITH TIME ZONE) - Buildium update timestamp

- **created_at** (TIMESTAMP WITH TIME ZONE) - Local creation timestamp

- **updated_at** (TIMESTAMP WITH TIME ZONE) - Local update timestamp

### Owners

- **id** (UUID, Primary Key) - Unique identifier

- **first_name** (VARCHAR(127)) - First name

- **last_name** (VARCHAR(127)) - Last name

- **is_company** (BOOLEAN) - Company flag

- **company_name** (VARCHAR(127)) - Company name

- **date_of_birth** (DATE) - Date of birth

- **management_agreement_start_date** (DATE) - Management agreement start

- **management_agreement_end_date** (DATE) - Management agreement end

- **email** (VARCHAR(255)) - Email address

- **alternate_email** (VARCHAR(255)) - Alternate email

- **phone_home** (VARCHAR(20)) - Home phone

- **phone_work** (VARCHAR(20)) - Work phone

- **phone_mobile** (VARCHAR(20)) - Mobile phone

- **phone_fax** (VARCHAR(20)) - Fax number

- **address_line1** (VARCHAR(100)) - Address line 1

- **address_line2** (VARCHAR(100)) - Address line 2

- **address_line3** (VARCHAR(100)) - Address line 3

- **city** (VARCHAR(100)) - City

- **state** (VARCHAR(100)) - State

- **postal_code** (VARCHAR(20)) - Postal code

- **country** (VARCHAR(100)) - Country

- **comment** (TEXT) - Comments

- **tax_payer_id** (VARCHAR(255)) - Tax payer ID

- **tax_payer_type** (VARCHAR(10)) - Tax payer type

- **tax_payer_name1** (VARCHAR(40)) - Tax payer name 1

- **tax_payer_name2** (VARCHAR(40)) - Tax payer name 2

- **tax_address_line1** (VARCHAR(100)) - Tax address line 1

- **tax_address_line2** (VARCHAR(100)) - Tax address line 2

- **tax_address_line3** (VARCHAR(100)) - Tax address line 3

- **tax_city** (VARCHAR(100)) - Tax city

- **tax_state** (VARCHAR(100)) - Tax state

- **tax_postal_code** (VARCHAR(20)) - Tax postal code

- **tax_country** (VARCHAR(100)) - Tax country

- **last_contacted** (TIMESTAMP WITH TIME ZONE) - Last contact timestamp

- **buildium_owner_id** (INTEGER) - Buildium API owner ID

- **tax_id** (VARCHAR(255)) - Tax identification number

- **is_active** (BOOLEAN) - Active status in Buildium

- **buildium_created_at** (TIMESTAMP WITH TIME ZONE) - Buildium creation timestamp

- **buildium_updated_at** (TIMESTAMP WITH TIME ZONE) - Buildium update timestamp

- **created_at** (TIMESTAMP WITH TIME ZONE) - Local creation timestamp

- **updated_at** (TIMESTAMP WITH TIME ZONE) - Local update timestamp

### Ownership

- **id** (UUID, Primary Key) - Unique identifier

- **primary** (BOOLEAN) - Primary ownership flag

- **ownership_percentage** (NUMERIC) - Ownership percentage

- **disbursement_percentage** (NUMERIC) - Disbursement percentage

- **owner_name** (VARCHAR(255)) - Owner name

- **owner_id** (UUID) - Owner reference

- **property_id** (UUID) - Property reference

- **created_at** (TIMESTAMP WITH TIME ZONE) - Creation timestamp

- **updated_at** (TIMESTAMP WITH TIME ZONE) - Update timestamp

### Leases

- **id** (BIGSERIAL, Primary Key) - Unique identifier

- **propertyId** (UUID) - Property reference

- **unitId** (UUID) - Unit reference

- **startDate** (TIMESTAMP WITHOUT TIME ZONE) - Lease start date

- **endDate** (TIMESTAMP WITHOUT TIME ZONE) - Lease end date

- **status** (VARCHAR(20)) - Lease status

- **depositAmt** (NUMERIC) - Deposit amount

- **notes** (TEXT) - Lease notes

- **buildium_lease_id** (INTEGER) - Buildium API lease ID

- **createdAt** (TIMESTAMP WITHOUT TIME ZONE) - Creation timestamp

- **updatedAt** (TIMESTAMP WITHOUT TIME ZONE) - Update timestamp

### Bank Accounts

- **id** (UUID, Primary Key) - Unique identifier

**Relationships:**
- **gl_account** → `gl_accounts.id` (Many-to-One): Each bank account can be associated with one general ledger account

- **buildium_bank_id** (INTEGER, NOT NULL) - Buildium API bank account ID

- **name** (VARCHAR(255), NOT NULL) - Bank account name

- **description** (TEXT) - Account description

- **bank_account_type** (VARCHAR(20)) - Account type

- **account_number** (VARCHAR(255)) - Account number

- **routing_number** (VARCHAR(255)) - Routing number

- **is_active** (BOOLEAN) - Whether the bank account is active or inactive

- **balance** (NUMERIC(15,2)) - Current balance of the bank account in local system

- **buildium_balance** (NUMERIC(15,2)) - Current balance of the bank account from Buildium API

- **gl_account** (UUID, NOT NULL) - Reference to the associated general ledger account

- **created_at** (TIMESTAMP WITH TIME ZONE) - Creation timestamp

- **updated_at** (TIMESTAMP WITH TIME ZONE) - Update timestamp

## Financial Tables

### Vendors

- **id** (UUID, Primary Key) - Unique identifier

- **buildium_vendor_id** (INTEGER) - Buildium API vendor ID

- **name** (VARCHAR(255)) - Vendor name

- **category_id** (INTEGER) - Category reference

- **contact_name** (VARCHAR(255)) - Contact person name

- **email** (VARCHAR(255)) - Email address

- **phone_number** (VARCHAR(50)) - Phone number

- **address_line1** (VARCHAR(255)) - Address line 1

- **address_line2** (VARCHAR(255)) - Address line 2

- **city** (VARCHAR(100)) - City

- **state** (VARCHAR(100)) - State

- **postal_code** (VARCHAR(20)) - Postal code

- **country** (VARCHAR(100)) - Country

- **tax_id** (VARCHAR(255)) - Tax ID

- **notes** (TEXT) - Notes

- **is_active** (BOOLEAN) - Active status

- **created_at** (TIMESTAMP WITH TIME ZONE) - Creation timestamp

- **updated_at** (TIMESTAMP WITH TIME ZONE) - Update timestamp

### Bills

- **id** (UUID, Primary Key) - Unique identifier

- **buildium_bill_id** (INTEGER) - Buildium API bill ID

- **vendor_id** (UUID) - Vendor reference

- **property_id** (UUID) - Property reference

- **unit_id** (UUID) - Unit reference

- **date** (DATE) - Bill date

- **due_date** (DATE) - Due date

- **amount** (DECIMAL(10,2)) - Bill amount

- **description** (TEXT) - Description

- **reference_number** (VARCHAR(255)) - Reference number

- **category_id** (INTEGER) - Category reference

- **is_recurring** (BOOLEAN) - Recurring flag

- **recurring_schedule** (JSONB) - Recurring schedule

- **status** (VARCHAR(20)) - Bill status

- **created_at** (TIMESTAMP WITH TIME ZONE) - Creation timestamp

- **updated_at** (TIMESTAMP WITH TIME ZONE) - Update timestamp

### Bill Payments

- **id** (UUID, Primary Key) - Unique identifier

- **buildium_payment_id** (INTEGER) - Buildium API payment ID

- **bill_id** (UUID) - Bill reference

- **bank_account_id** (UUID) - Bank account reference

- **amount** (DECIMAL(10,2)) - Payment amount

- **date** (DATE) - Payment date

- **reference_number** (VARCHAR(255)) - Reference number

- **memo** (TEXT) - Payment memo

- **created_at** (TIMESTAMP WITH TIME ZONE) - Creation timestamp

- **updated_at** (TIMESTAMP WITH TIME ZONE) - Update timestamp

### GL Accounts

- **id** (UUID, Primary Key) - Unique identifier

- **buildium_gl_account_id** (INTEGER, NOT NULL) - Buildium API GL account ID

- **account_number** (VARCHAR(50)) - Account number

- **name** (VARCHAR(255), NOT NULL) - Account name

- **description** (TEXT) - Account description

- **type** (VARCHAR(50), NOT NULL) - Account type (Income, Liability, Asset, Expense, Equity)

- **sub_type** (VARCHAR(50)) - Account subtype (CurrentLiability, Income, etc.)

- **is_default_gl_account** (BOOLEAN) - Whether this is a default GL account

- **default_account_name** (VARCHAR(255)) - Default account name

- **is_contra_account** (BOOLEAN) - Whether this is a contra account

- **is_bank_account** (BOOLEAN) - Whether this is a bank account

- **cash_flow_classification** (VARCHAR(50)) - Cash flow classification

- **exclude_from_cash_balances** (BOOLEAN) - Whether to exclude from cash balances

- **is_active** (BOOLEAN) - Whether the account is active

- **buildium_parent_gl_account_id** (INTEGER) - Buildium API parent GL account ID

- **is_credit_card_account** (BOOLEAN) - Whether this is a credit card account

- **created_at** (TIMESTAMP WITH TIME ZONE) - Creation timestamp

- **updated_at** (TIMESTAMP WITH TIME ZONE) - Update timestamp

### Vendor Categories

- **id** (UUID, Primary Key) - Unique identifier

- **buildium_category_id** (INTEGER) - Buildium API category ID

- **name** (VARCHAR(255)) - Category name

- **description** (TEXT) - Category description

- **is_active** (BOOLEAN) - Active status

- **created_at** (TIMESTAMP WITH TIME ZONE) - Creation timestamp

- **updated_at** (TIMESTAMP WITH TIME ZONE) - Update timestamp

### Bill Categories

- **id** (UUID, Primary Key) - Unique identifier

- **buildium_category_id** (INTEGER) - Buildium API category ID

- **name** (VARCHAR(255)) - Category name

- **description** (TEXT) - Category description

- **is_active** (BOOLEAN) - Active status

- **created_at** (TIMESTAMP WITH TIME ZONE) - Creation timestamp

- **updated_at** (TIMESTAMP WITH TIME ZONE) - Update timestamp

## Maintenance Tables

### Tasks

- **id** (UUID, Primary Key) - Unique identifier

- **buildium_task_id** (INTEGER) - Buildium API task ID

- **property_id** (UUID) - Property reference

- **unit_id** (UUID) - Unit reference

- **subject** (VARCHAR(255)) - Task subject

- **description** (TEXT) - Task description

- **priority** (VARCHAR(20)) - Priority level

- **status** (VARCHAR(20)) - Task status

- **assigned_to** (VARCHAR(255)) - Assigned person

- **estimated_cost** (DECIMAL(10,2)) - Estimated cost

- **actual_cost** (DECIMAL(10,2)) - Actual cost

- **scheduled_date** (TIMESTAMP WITH TIME ZONE) - Scheduled date

- **completed_date** (TIMESTAMP WITH TIME ZONE) - Completion date

- **category** (VARCHAR(100)) - Task category

- **notes** (TEXT) - Task notes

- **created_at** (TIMESTAMP WITH TIME ZONE) - Creation timestamp

- **updated_at** (TIMESTAMP WITH TIME ZONE) - Update timestamp

### Work Orders

- **id** (UUID, Primary Key) - Unique identifier

- **buildium_work_order_id** (INTEGER) - Buildium API work order ID

- **property_id** (UUID) - Property reference

- **unit_id** (UUID) - Unit reference

- **subject** (VARCHAR(255)) - Work order subject

- **description** (TEXT) - Work order description

- **priority** (VARCHAR(20)) - Priority level

- **status** (VARCHAR(20)) - Work order status

- **assigned_to** (VARCHAR(255)) - Assigned person

- **estimated_cost** (DECIMAL(10,2)) - Estimated cost

- **actual_cost** (DECIMAL(10,2)) - Actual cost

- **scheduled_date** (TIMESTAMP WITH TIME ZONE) - Scheduled date

- **completed_date** (TIMESTAMP WITH TIME ZONE) - Completion date

- **category** (VARCHAR(100)) - Work order category

- **notes** (TEXT) - Work order notes

- **created_at** (TIMESTAMP WITH TIME ZONE) - Creation timestamp

- **updated_at** (TIMESTAMP WITH TIME ZONE) - Update timestamp

### Task Categories

- **id** (UUID, Primary Key) - Unique identifier

- **buildium_category_id** (INTEGER) - Buildium API category ID

- **name** (VARCHAR(255)) - Category name

- **description** (TEXT) - Category description

- **color** (VARCHAR(7)) - Hex color code

- **is_active** (BOOLEAN) - Active status

- **created_at** (TIMESTAMP WITH TIME ZONE) - Creation timestamp

- **updated_at** (TIMESTAMP WITH TIME ZONE) - Update timestamp

### Task History

- **id** (UUID, Primary Key) - Unique identifier

- **buildium_history_id** (INTEGER) - Buildium API history ID

- **task_id** (UUID) - Task reference

- **status** (VARCHAR(20)) - Status at this point

- **notes** (TEXT) - History notes

- **completed_date** (TIMESTAMP WITH TIME ZONE) - Completion date

- **assigned_to** (VARCHAR(255)) - Assigned person

- **created_at** (TIMESTAMP WITH TIME ZONE) - Creation timestamp

- **updated_at** (TIMESTAMP WITH TIME ZONE) - Update timestamp

### Task History Files

- **id** (UUID, Primary Key) - Unique identifier

- **buildium_file_id** (INTEGER) - Buildium API file ID

- **task_history_id** (UUID) - Task history reference

- **file_name** (VARCHAR(255)) - File name

- **file_type** (VARCHAR(100)) - File type

- **file_size** (INTEGER) - File size in bytes

- **file_url** (TEXT) - File URL

- **description** (TEXT) - File description

- **created_at** (TIMESTAMP WITH TIME ZONE) - Creation timestamp

- **updated_at** (TIMESTAMP WITH TIME ZONE) - Update timestamp

## Integration Tables

### Buildium Sync Status

- **id** (UUID, Primary Key) - Unique identifier

- **entity_type** (VARCHAR(50)) - Entity type (property, unit, owner, lease, bank_account)

- **entity_id** (UUID) - Local entity ID

- **buildium_id** (INTEGER) - Buildium API entity ID

- **last_synced_at** (TIMESTAMP WITH TIME ZONE) - Last sync timestamp

- **sync_status** (VARCHAR(20)) - Sync status (pending, synced, failed)

- **error_message** (TEXT) - Error message if sync failed

- **created_at** (TIMESTAMP WITH TIME ZONE) - Creation timestamp

- **updated_at** (TIMESTAMP WITH TIME ZONE) - Update timestamp

### Buildium API Cache

- **id** (UUID, Primary Key) - Unique identifier

- **endpoint** (VARCHAR(255)) - API endpoint

- **parameters** (JSONB) - Request parameters

- **response_data** (JSONB) - Cached response data

- **expires_at** (TIMESTAMP WITH TIME ZONE) - Cache expiration

- **created_at** (TIMESTAMP WITH TIME ZONE) - Creation timestamp

- **updated_at** (TIMESTAMP WITH TIME ZONE) - Update timestamp

### Buildium Webhook Events

- **id** (UUID, Primary Key) - Unique identifier

- **event_id** (VARCHAR(255)) - Unique event ID

- **event_type** (VARCHAR(100)) - Event type

- **event_data** (JSONB) - Event data

- **processed** (BOOLEAN) - Processing status

- **processed_at** (TIMESTAMP WITH TIME ZONE) - Processing timestamp

- **error_message** (TEXT) - Error message

- **retry_count** (INTEGER) - Retry count

- **max_retries** (INTEGER) - Maximum retries

- **created_at** (TIMESTAMP WITH TIME ZONE) - Creation timestamp

- **updated_at** (TIMESTAMP WITH TIME ZONE) - Update timestamp

### Buildium API Log

- **id** (UUID, Primary Key) - Unique identifier

- **endpoint** (VARCHAR(255)) - API endpoint

- **method** (VARCHAR(10)) - HTTP method

- **request_data** (JSONB) - Request data

- **response_status** (INTEGER) - Response status code

- **response_data** (JSONB) - Response data

- **error_message** (TEXT) - Error message

- **duration_ms** (INTEGER) - Request duration in milliseconds

- **created_at** (TIMESTAMP WITH TIME ZONE) - Creation timestamp

## Cache Tables

### Owners List Cache

- **owner_id** (UUID, Primary Key) - Owner reference

- **contact_id** (BIGINT) - Contact reference

- **display_name** (TEXT) - Display name

- **primary_email** (TEXT) - Primary email

- **primary_phone** (TEXT) - Primary phone

- **management_agreement_start_date** (DATE) - Agreement start date

- **management_agreement_end_date** (DATE) - Agreement end date

- **updated_at** (TIMESTAMP WITH TIME ZONE) - Update timestamp

### Property Ownerships Cache

- **ownership_id** (UUID, Primary Key) - Ownership reference

- **property_id** (UUID) - Property reference

- **owner_id** (UUID) - Owner reference

- **contact_id** (BIGINT) - Contact reference

- **display_name** (TEXT) - Display name

- **primary_email** (TEXT) - Primary email

- **primary** (BOOLEAN) - Primary ownership flag

- **ownership_percentage** (NUMERIC(5,2)) - Ownership percentage

- **disbursement_percentage** (NUMERIC(5,2)) - Disbursement percentage

- **updated_at** (TIMESTAMP WITH TIME ZONE) - Update timestamp

## Relationships

### Core Relationships

- **properties** ↔ **units** (One-to-Many)

- **properties** ↔ **ownership** (One-to-Many)

- **owners** ↔ **ownership** (One-to-Many)

- **properties** ↔ **Lease** (One-to-Many)

- **units** ↔ **Lease** (One-to-Many)

### Financial Relationships

- **vendors** ↔ **bills** (One-to-Many)

- **properties** ↔ **bills** (One-to-Many)

- **units** ↔ **bills** (One-to-Many)

- **bills** ↔ **bill_payments** (One-to-Many)

- **bank_accounts** ↔ **bill_payments** (One-to-Many)

- **vendor_categories** ↔ **vendors** (One-to-Many)

- **bill_categories** ↔ **bills** (One-to-Many)

### Maintenance Relationships

- **properties** ↔ **tasks** (One-to-Many)

- **units** ↔ **tasks** (One-to-Many)

- **tasks** ↔ **task_history** (One-to-Many)

- **task_history** ↔ **task_history_files** (One-to-Many)

- **properties** ↔ **work_orders** (One-to-Many)

- **units** ↔ **work_orders** (One-to-Many)

- **task_categories** ↔ **tasks** (One-to-Many)

### Integration Relationships

- **buildium_sync_status** ↔ All entities (Many-to-One)

- **buildium_webhook_events** ↔ All entities (Many-to-One)

## Indexes

### Core Table Indexes

- `properties_name_idx` - Properties by name
- `units_property_id_idx` - Units by property
- `units_property_id_unit_number_key` - Unique unit numbers per property
- `owners_last_name_first_name_idx` - Owners by name
- `ownership_owner_id_idx` - Ownership by owner
- `ownership_property_id_idx` - Ownership by property
- `ownership_owner_id_property_id_key` - Unique ownership per owner/property

### Financial Table Indexes

- `idx_vendors_name` - Vendors by name
- `idx_vendors_category` - Vendors by category
- `idx_vendors_active` - Active vendors
- `idx_bills_vendor` - Bills by vendor
- `idx_bills_property` - Bills by property
- `idx_bills_unit` - Bills by unit
- `idx_bills_date` - Bills by date
- `idx_bills_status` - Bills by status
- `idx_bill_payments_bill` - Payments by bill
- `idx_bill_payments_bank` - Payments by bank account

### Maintenance Table Indexes

- `idx_tasks_property` - Tasks by property
- `idx_tasks_unit` - Tasks by unit
- `idx_tasks_status` - Tasks by status
- `idx_tasks_priority` - Tasks by priority
- `idx_tasks_assigned` - Tasks by assignee
- `idx_work_orders_property` - Work orders by property
- `idx_work_orders_unit` - Work orders by unit
- `idx_work_orders_status` - Work orders by status

### Integration Table Indexes

- `idx_buildium_sync_entity` - Sync status by entity
- `idx_buildium_sync_status` - Sync status by status
- `idx_buildium_cache_endpoint` - Cache by endpoint
- `idx_buildium_cache_expires` - Cache by expiration
- `idx_webhook_events_type` - Webhook events by type
- `idx_webhook_events_processed` - Webhook events by processing status

## Data Types

The database uses the following data types:

- **UUID**: Unique identifier (primary keys)

- **VARCHAR**: Variable-length character strings

- **TEXT**: Long text content

- **INTEGER**: Whole numbers

- **DECIMAL**: Decimal numbers with precision

- **NUMERIC**: Numeric values with precision

- **BOOLEAN**: True/false values

- **TIMESTAMP**: Date and time values

- **DATE**: Date values

- **JSONB**: JSON data structures

- **BIGSERIAL**: Auto-incrementing big integers

## Naming Conventions

- Table names are in snake_case
- Column names are in snake_case
- Primary keys are named `id`
- Foreign keys are named `{table_name}_id`
- Timestamps are named `created_at` and `updated_at`
- Buildium-specific fields are prefixed with `buildium_`

## Best Practices

1. All tables have a primary key
2. Foreign keys have appropriate constraints
3. Important columns are indexed for performance
4. Sensitive data is properly encrypted
5. Audit trails are maintained with timestamps
6. Row Level Security (RLS) is enabled on all tables
7. Comprehensive error handling and logging
8. Caching mechanisms for performance optimization
9. Webhook processing for real-time synchronization
10. Buildium API integration with bidirectional sync support

## Buildium Integration Features

### Data Synchronization

- Complete bidirectional sync between local and Buildium data
- Sync status tracking for all entities
- Error handling and retry mechanisms
- Real-time webhook processing

### Performance Optimization

- API response caching to reduce external calls
- Denormalized cache tables for fast reads
- Comprehensive indexing strategy
- Efficient query optimization

### Monitoring and Debugging

- Complete API request/response logging
- Webhook event processing tracking
- Error tracking and debugging support
- Performance monitoring with duration tracking

### Data Mapping

- Automated mapping functions for all entity types
- Buildium-compatible field structures
- Validation and error handling
- Flexible JSONB storage for complex data

The database schema is now fully optimized for comprehensive Buildium API
integration with robust error handling, performance optimization, and complete
data synchronization capabilities.
