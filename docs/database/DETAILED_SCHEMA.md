# Detailed Database Schema Documentation

> **Last Updated**: 2025-01-15T17:33:36.080Z (Auto-generated)
>
> This document provides comprehensive field-level details including constraints, defaults, and enum values.

## Overview

This document describes the detailed database schema for the Property Management System with comprehensive Buildium API integration support. It includes all field constraints, default values, and enum definitions that are essential for developers.
## Core Tables

### Properties

**Table**: `public.properties`

**Purpose**: Central property information with comprehensive address and financial details.

**Schema Definition:**
```sql
CREATE TABLE "public"."properties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(127) NOT NULL,
    "structure_description" "text",
    "address_line1" character varying(100) NOT NULL,
    "address_line2" character varying(100),
    "address_line3" character varying(100),
    "city" character varying(100),
    "state" character varying(100),
    "postal_code" character varying(20) NOT NULL,
    "buildium_property_id" integer,
    "rental_owner_ids" integer[],
    "reserve" numeric,
    "year_built" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "country" "public"."countries" NOT NULL,
    "property_type" public.property_type_enum,
    "operating_bank_account_id" "uuid",
    "primary_owner" character varying(255),
    "status" "public"."property_status" DEFAULT 'Active'::"public"."property_status" NOT NULL,
    "deposit_trust_account_id" "uuid",
    "total_units" integer DEFAULT 0 NOT NULL,
    "property_type" character varying(100),
    "is_active" boolean DEFAULT true,
    "buildium_created_at" timestamp with time zone,
    "buildium_updated_at" timestamp with time zone,
    "rental_type" character varying(50)
);
```

**Field Details:**

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| `id` | UUID | NOT NULL, Primary Key | `gen_random_uuid()` | Unique identifier |
| `name` | VARCHAR(127) | NOT NULL | - | Property name |
| `structure_description` | TEXT | - | - | Property description |
| `address_line1` | VARCHAR(100) | NOT NULL | - | Primary address line |
| `address_line2` | VARCHAR(100) | - | - | Secondary address line |
| `address_line3` | VARCHAR(100) | - | - | Tertiary address line |
| `city` | VARCHAR(100) | - | - | City |
| `state` | VARCHAR(100) | - | - | State |
| `postal_code` | VARCHAR(20) | NOT NULL | - | Postal code |
| `buildium_property_id` | INTEGER | - | - | Buildium API property ID |
| `rental_owner_ids` | INTEGER[] | - | - | Array of owner IDs |
| `reserve` | NUMERIC | - | - | Reserve amount |
| `year_built` | INTEGER | - | - | Year property was built |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL | `now()` | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NOT NULL | - | Update timestamp |
| `country` | `public.countries` | NOT NULL | - | Country (enum) |
| `property_type` | property_type_enum | ✓ (NULL=None) | - | UI property type enum |
| `operating_bank_account_id` | UUID | - | - | Operating bank account reference |
| `primary_owner` | VARCHAR(255) | - | - | Primary owner name |
| `status` | `public.property_status` | NOT NULL | `'Active'` | Property status (enum) |
| `deposit_trust_account_id` | UUID | - | - | Deposit trust account reference |
| `total_units` | INTEGER | NOT NULL | `0` | Total number of units |
| `property_type` | VARCHAR(100) | - | - | Buildium property type |
| `is_active` | BOOLEAN | - | `true` | Active status in Buildium |
| `buildium_created_at` | TIMESTAMP WITH TIME ZONE | - | - | Buildium creation timestamp |
| `buildium_updated_at` | TIMESTAMP WITH TIME ZONE | - | - | Buildium update timestamp |
| `rental_type` | VARCHAR(50) | - | - | Rental type classification |

**Enum Definitions:**

### `public.countries`
Comprehensive list of world countries. See `supabase/migrations/010_create_countries_enum.sql` for complete list.

### `public.property_status`
```sql
CREATE TYPE "public"."property_status" AS ENUM (
    'Active',
    'Inactive',
    'Pending',
    'Sold',
    'Under Construction'
);
```

**Relationships:**
- **One-to-Many**: `properties` → `units` (via `property_id`)
- **Many-to-Many**: `properties` ↔ `owners` (via `ownerships` table)
- **One-to-One**: `properties` → `bank_accounts` (via `operating_bank_account_id`)

**Buildium Integration Notes:**
- `buildium_property_id` is populated during sync and has a unique constraint (`properties_buildium_property_id_unique`).
- `buildium_created_at` and `buildium_updated_at` mirror timestamps from Buildium for auditing.
- Indexes exist on Buildium ID fields in related tables for efficient joins and lookups.

### Units

**Table**: `public.units`

**Purpose**: Individual rental units within properties.

**Schema Definition:**
```sql
CREATE TABLE "public"."units" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "unit_number" character varying(30) NOT NULL,
    "unit_size" integer,
    "market_rent" numeric,
    "address_line1" character varying(100),
    "address_line2" character varying(100),
    "address_line3" character varying(100),
    "city" character varying(100),
    "state" character varying(100),
    "postal_code" character varying(20),
    "country" "text",
    "unit_bedrooms" character varying(20),
    "unit_bathrooms" character varying(20),
    "description" "text",
    "building_name" character varying(100),
    "buildium_unit_id" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);
```

**Field Details:**

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| `id` | UUID | NOT NULL, Primary Key | `gen_random_uuid()` | Unique identifier |
| `property_id` | UUID | NOT NULL, Foreign Key | - | Property reference |
| `unit_number` | VARCHAR(30) | NOT NULL | - | Unit number |
| `unit_size` | INTEGER | - | - | Unit size |
| `market_rent` | NUMERIC | - | - | Market rent amount |
| `address_line1` | VARCHAR(100) | - | - | Unit address line 1 |
| `address_line2` | VARCHAR(100) | - | - | Unit address line 2 |
| `address_line3` | VARCHAR(100) | - | - | Unit address line 3 |
| `city` | VARCHAR(100) | - | - | City |
| `state` | VARCHAR(100) | - | - | State |
| `postal_code` | VARCHAR(20) | - | - | Postal code |
| `country` | TEXT | - | - | Country |
| `unit_bedrooms` | VARCHAR(20) | - | - | Number of bedrooms |
| `unit_bathrooms` | VARCHAR(20) | - | - | Number of bathrooms |
| `description` | TEXT | - | - | Unit description |
| `building_name` | VARCHAR(100) | - | - | Building name |
| `buildium_unit_id` | INTEGER | - | - | Buildium API unit ID |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL | `now()` | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NOT NULL | - | Update timestamp |

**Relationships:**
- **Many-to-One**: `units` → `properties` (via `property_id`)
- **One-to-Many**: `units` → `leases` (via `unit_id`)

**Buildium Integration Notes:**
- Buildium ID fields used for cross-system mapping:
  - `buildium_unit_id` (unique per unit)
  - `buildium_property_id` (the parent property’s Buildium ID)
- Timestamps (if present): `buildium_created_at`, `buildium_updated_at` capture first seen/last updated from Buildium.- Common indexes: `idx_units_buildium_id` on `buildium_unit_id` and triggers to set `buildium_property_id` from related property when available.

### Owners

**Table**: `public.owners`

**Purpose**: Property owners (individuals and companies).

**Schema Definition:**
```sql
CREATE TABLE "public"."owners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "management_agreement_start_date" "date",
    "management_agreement_end_date" "date",
    "comment" "text",
    "tax_payer_name1" character varying(40),
    "tax_payer_name2" character varying(40),
    "tax_address_line1" character varying(100),
    "tax_address_line2" character varying(100),
    "tax_address_line3" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "etf_account_type" "public"."etf_account_type_enum",
    "etf_account_number" numeric,
    "etf_routing_number" numeric,
    "contact_id" bigint,
    "tax_payer_id" "text",
    "tax_payer_type" "text",
    "tax_city" "text",
    "tax_state" "text",
    "tax_postal_code" "text",
    "tax_country" "text",
    "last_contacted" timestamp with time zone,
    "buildium_owner_id" integer,
    "is_active" boolean DEFAULT true,
    "buildium_created_at" timestamp with time zone,
    "buildium_updated_at" timestamp with time zone,
    "tax_include1099" boolean DEFAULT false
);
```

**Field Details:**

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| `id` | UUID | NOT NULL, Primary Key | `gen_random_uuid()` | Unique identifier |
| `management_agreement_start_date` | DATE | - | - | Management agreement start |
| `management_agreement_end_date` | DATE | - | - | Management agreement end |
| `comment` | TEXT | - | - | Owner comments |
| `tax_payer_name1` | VARCHAR(40) | - | - | Primary tax payer name |
| `tax_payer_name2` | VARCHAR(40) | - | - | Secondary tax payer name |
| `tax_address_line1` | VARCHAR(100) | - | - | Tax address line 1 |
| `tax_address_line2` | VARCHAR(100) | - | - | Tax address line 2 |
| `tax_address_line3` | VARCHAR(100) | - | - | Tax address line 3 |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL | `now()` | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NOT NULL | - | Update timestamp |
| `etf_account_type` | `public.etf_account_type_enum` | - | - | ETF account type |
| `etf_account_number` | NUMERIC | - | - | ETF account number |
| `etf_routing_number` | NUMERIC | - | - | ETF routing number |
| `contact_id` | BIGINT | - | - | Contact reference |
| `tax_payer_id` | TEXT | - | - | Tax payer ID |
| `tax_payer_type` | TEXT | - | - | Tax payer type |
| `tax_city` | TEXT | - | - | Tax city |
| `tax_state` | TEXT | - | - | Tax state |
| `tax_postal_code` | TEXT | - | - | Tax postal code |
| `tax_country` | TEXT | - | - | Tax country |
| `last_contacted` | TIMESTAMP WITH TIME ZONE | - | - | Last contact timestamp |
| `buildium_owner_id` | INTEGER | - | - | Buildium API owner ID |
| `is_active` | BOOLEAN | - | `true` | Active status |
| `buildium_created_at` | TIMESTAMP WITH TIME ZONE | - | - | Buildium creation timestamp |
| `buildium_updated_at` | TIMESTAMP WITH TIME ZONE | - | - | Buildium update timestamp |
| `tax_include1099` | BOOLEAN | - | `false` | Include in 1099 reporting |

**Enum Definitions:**

### `public.etf_account_type_enum`
```sql
CREATE TYPE "public"."etf_account_type_enum" AS ENUM (
    'Checking',
    'Savings'
);
```

**Relationships:**
- **Many-to-Many**: `owners` ↔ `properties` (via `ownerships` table)

### Ownerships

**Table**: `public.ownerships`

**Purpose**: Property-owner relationships with percentages.

**Schema Definition:**
```sql
CREATE TABLE "public"."ownerships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "ownership_percentage" numeric(5,2) NOT NULL DEFAULT 100.00,
    "disbursement_percentage" numeric(5,2) NOT NULL DEFAULT 100.00,
    "is_primary_owner" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "total_units" integer DEFAULT 0 NOT NULL,
    "total_properties" integer DEFAULT 0 NOT NULL
);
```

**Field Details:**

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| `id` | UUID | NOT NULL, Primary Key | `gen_random_uuid()` | Unique identifier |
| `property_id` | UUID | NOT NULL, Foreign Key | - | Property reference |
| `owner_id` | UUID | NOT NULL, Foreign Key | - | Owner reference |
| `ownership_percentage` | NUMERIC(5,2) | NOT NULL | `100.00` | Ownership percentage |
| `disbursement_percentage` | NUMERIC(5,2) | NOT NULL | `100.00` | Disbursement percentage |
| `is_primary_owner` | BOOLEAN | - | `false` | Primary owner flag |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL | `now()` | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NOT NULL | - | Update timestamp |
| `total_units` | INTEGER | NOT NULL | `0` | Total units owned |
| `total_properties` | INTEGER | NOT NULL | `0` | Total properties owned |

**Relationships:**
- **Many-to-One**: `ownerships` → `properties` (via `property_id`)
- **Many-to-One**: `ownerships` → `owners` (via `owner_id`)

## Best Practices

### Field Naming Conventions
- **Snake_case**: All database fields use snake_case
- **Timestamps**: `created_at`, `updated_at` for audit trails
- **Buildium Integration**: `buildium_*` prefix for external API fields
- **Foreign Keys**: `{table_name}_id` pattern

### Data Types
- **UUIDs**: For primary keys and relationships
- **VARCHAR with Lengths**: Enforced length constraints for data integrity
- **NUMERIC**: For financial amounts (precision/scale specified)
- **TIMESTAMP WITH TIME ZONE**: For all datetime fields
- **Enums**: For constrained value sets

### Constraints
- **NOT NULL**: Applied to required fields
- **Defaults**: Sensible defaults for common scenarios
- **Foreign Keys**: Proper referential integrity
- **Unique Constraints**: Where business logic requires

### Indexes
- **Primary Keys**: Automatic indexes
- **Foreign Keys**: Automatic indexes
- **Common Queries**: Additional indexes for performance
- **Composite Indexes**: For multi-field queries

This detailed schema documentation ensures developers have complete information about field constraints, defaults, and relationships for proper application development.

### Lease

**Table**: `public.lease`

**Purpose**: Lease agreements between properties/units and tenants.

**Schema Definition:**
```sql
CREATE TABLE "public"."lease" (
    "id" bigint NOT NULL,
    "propertyId" "uuid" NOT NULL,
    "lease_from_date" timestamp without time zone NOT NULL,
    "lease_to_date" timestamp without time zone,
    "status" character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    "security_deposit" numeric,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "unitId" "uuid" NOT NULL,
    "buildium_lease_id" integer,
    "unit_number" character varying(50),
    "lease_type" character varying(50),
    "term_type" character varying(50),
    "renewal_offer_status" character varying(50),
    "is_eviction_pending" boolean DEFAULT false,
    "current_number_of_occupants" integer,
    "payment_due_day" integer,
    "automatically_move_out_tenants" boolean DEFAULT false,
    "buildium_created_at" timestamp with time zone,
    "buildium_updated_at" timestamp with time zone,
    "rent_amount" numeric,
    "buildium_property_id" integer,
    "buildium_unit_id" integer
);
```

**Field Details:**

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| `id` | BIGINT | NOT NULL, Primary Key | - | Unique identifier |
| `propertyId` | UUID | NOT NULL, Foreign Key | - | Property reference |
| `lease_from_date` | TIMESTAMP WITHOUT TIME ZONE | NOT NULL | - | Lease start date |
| `lease_to_date` | TIMESTAMP WITHOUT TIME ZONE | - | - | Lease end date |
| `status` | VARCHAR(20) | NOT NULL | `'ACTIVE'` | Lease status |
| `security_deposit` | NUMERIC | - | - | Security deposit amount |
| `comment` | TEXT | - | - | Lease comments |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL | `CURRENT_TIMESTAMP` | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NOT NULL | - | Update timestamp |
| `unitId` | UUID | NOT NULL, Foreign Key | - | Unit reference |
| `buildium_lease_id` | INTEGER | - | - | Buildium API lease ID |
| `unit_number` | VARCHAR(50) | - | - | Unit number |
| `lease_type` | VARCHAR(50) | - | - | Type of lease |
| `term_type` | VARCHAR(50) | - | - | Term type |
| `renewal_offer_status` | VARCHAR(50) | - | - | Renewal offer status |
| `is_eviction_pending` | BOOLEAN | - | `false` | Eviction pending flag |
| `current_number_of_occupants` | INTEGER | - | - | Current occupants count |
| `payment_due_day` | INTEGER | - | - | Day of month payment is due |
| `automatically_move_out_tenants` | BOOLEAN | - | `false` | Auto move-out flag |
| `buildium_created_at` | TIMESTAMP WITH TIME ZONE | - | - | Buildium creation timestamp |
| `buildium_updated_at` | TIMESTAMP WITH TIME ZONE | - | - | Buildium update timestamp |
| `rent_amount` | NUMERIC | - | - | Monthly rent amount |
| `buildium_property_id` | INTEGER | - | - | Buildium property ID |
| `buildium_unit_id` | INTEGER | - | - | Buildium unit ID |

**Relationships:**
- **Many-to-One**: `lease` → `properties` (via `propertyId`)
- **Many-to-One**: `lease` → `units` (via `unitId`)

### Bank Accounts

**Table**: `public.bank_accounts`

**Purpose**: Financial account management for properties and operations.

**Schema Definition:**
```sql
CREATE TABLE "public"."bank_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buildium_bank_id" integer NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "bank_account_type" character varying(20) NOT NULL,
    "account_number" character varying(255),
    "routing_number" character varying(255),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "balance" numeric(15,2) DEFAULT 0.00,
    "buildium_balance" numeric(15,2) DEFAULT 0.00,
    "gl_account" "uuid" NOT NULL
);
```

**Field Details:**

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| `id` | UUID | NOT NULL, Primary Key | `gen_random_uuid()` | Unique identifier |
| `buildium_bank_id` | INTEGER | NOT NULL | - | Buildium API bank account ID |
| `name` | VARCHAR(255) | NOT NULL | - | Bank account name |
| `description` | TEXT | - | - | Account description |
| `bank_account_type` | VARCHAR(20) | NOT NULL | - | Account type |
| `account_number` | VARCHAR(255) | - | - | Account number |
| `routing_number` | VARCHAR(255) | - | - | Routing number |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL | `now()` | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NOT NULL | - | Update timestamp |
| `is_active` | BOOLEAN | NOT NULL | `true` | Active status |
| `balance` | NUMERIC(15,2) | - | `0.00` | Current balance |
| `buildium_balance` | NUMERIC(15,2) | - | `0.00` | Buildium balance |
| `gl_account` | UUID | NOT NULL, Foreign Key | - | GL account reference |

**Relationships:**
- **Many-to-One**: `bank_accounts` → `gl_accounts` (via `gl_account`)

### Contacts

**Table**: `public.contacts`

**Purpose**: People and company contact information.

**Schema Definition:**
```sql
CREATE TABLE "public"."contacts" (
    "id" bigint NOT NULL,
    "is_company" boolean DEFAULT false NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "company_name" "text",
    "primary_email" "text",
    "alt_email" "text",
    "primary_phone" "text",
    "alt_phone" "text",
    "date_of_birth" "date",
    "primary_address_line_1" "text",
    "primary_address_line_2" "text",
    "primary_address_line_3" "text",
    "primary_city" "text",
    "primary_state" "text",
    "primary_postal_code" "text",
    "primary_country" "public"."countries" DEFAULT 'United States'::"public"."countries",
    "alt_address_line_1" "text",
    "alt_address_line_2" "text",
    "alt_address_line_3" "text",
    "alt_city" "text",
    "alt_state" "text",
    "alt_postal_code" "text",
    "alt_country" "public"."countries",
    "mailing_preference" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);
```

**Field Details:**

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| `id` | BIGINT | NOT NULL, Primary Key | - | Unique identifier |
| `is_company` | BOOLEAN | NOT NULL | `false` | Company flag |
| `first_name` | TEXT | - | - | First name |
| `last_name` | TEXT | - | - | Last name |
| `company_name` | TEXT | - | - | Company name |
| `primary_email` | TEXT | - | - | Primary email |
| `alt_email` | TEXT | - | - | Alternative email |
| `primary_phone` | TEXT | - | - | Primary phone |
| `alt_phone` | TEXT | - | - | Alternative phone |
| `date_of_birth` | DATE | - | - | Date of birth |
| `primary_address_line_1` | TEXT | - | - | Primary address line 1 |
| `primary_address_line_2` | TEXT | - | - | Primary address line 2 |
| `primary_address_line_3` | TEXT | - | - | Primary address line 3 |
| `primary_city` | TEXT | - | - | Primary city |
| `primary_state` | TEXT | - | - | Primary state |
| `primary_postal_code` | TEXT | - | - | Primary postal code |
| `primary_country` | `public.countries` | - | `'United States'` | Primary country |
| `alt_address_line_1` | TEXT | - | - | Alternative address line 1 |
| `alt_address_line_2` | TEXT | - | - | Alternative address line 2 |
| `alt_address_line_3` | TEXT | - | - | Alternative address line 3 |
| `alt_city` | TEXT | - | - | Alternative city |
| `alt_state` | TEXT | - | - | Alternative state |
| `alt_postal_code` | TEXT | - | - | Alternative postal code |
| `alt_country` | `public.countries` | - | - | Alternative country |
| `mailing_preference` | TEXT | - | - | Mailing preference |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL | `now()` | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NOT NULL | - | Update timestamp |

**Relationships:**
- **One-to-Many**: `contacts` → `tenants` (via `contact_id`)

### Tenants

**Table**: `public.tenants`

**Purpose**: Tenant information linked to contacts.

**Schema Definition:**
```sql
CREATE TABLE "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" bigint NOT NULL,
    "buildium_tenant_id" integer,
    "emergency_contact_name" "text",
    "emergency_contact_relationship" "text",
    "emergency_contact_phone" "text",
    "emergency_contact_email" "text",
    "sms_opt_in_status" character varying(50),
    "comment" "text",
    "tax_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);
```

**Field Details:**

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| `id` | UUID | NOT NULL, Primary Key | `gen_random_uuid()` | Unique identifier |
| `contact_id` | BIGINT | NOT NULL, Foreign Key | - | Contact reference |
| `buildium_tenant_id` | INTEGER | - | - | Buildium API tenant ID |
| `emergency_contact_name` | TEXT | - | - | Emergency contact name |
| `emergency_contact_relationship` | TEXT | - | - | Emergency contact relationship |
| `emergency_contact_phone` | TEXT | - | - | Emergency contact phone |
| `emergency_contact_email` | TEXT | - | - | Emergency contact email |
| `sms_opt_in_status` | VARCHAR(50) | - | - | SMS opt-in status |
| `comment` | TEXT | - | - | Tenant comments |
| `tax_id` | TEXT | - | - | Tax ID |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL | `now()` | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NOT NULL | - | Update timestamp |

**Relationships:**
- **Many-to-One**: `tenants` → `contacts` (via `contact_id`)

### GL Accounts

**Table**: `public.gl_accounts`

**Purpose**: General ledger accounts imported from Buildium, supporting hierarchical parent/child structures.

**Schema Definition:**
```sql
CREATE TABLE "public"."gl_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buildium_gl_account_id" integer NOT NULL,
    "account_number" character varying(50),
    "name" character varying(255) NOT NULL,
    "description" "text",
    "type" character varying(50) NOT NULL,
    "sub_type" character varying(50),
    "is_default_gl_account" boolean DEFAULT false,
    "default_account_name" character varying(255),
    "is_contra_account" boolean DEFAULT false,
    "is_bank_account" boolean DEFAULT false,
    "cash_flow_classification" character varying(50),
    "exclude_from_cash_balances" boolean DEFAULT false,
    "is_active" boolean DEFAULT true,
    "buildium_parent_gl_account_id" integer,
    "is_credit_card_account" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "sub_accounts" "uuid"[] DEFAULT '{}'::"uuid"[]
);
```

**Field Details:**

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| `id` | UUID | NOT NULL, Primary Key | `gen_random_uuid()` | Local unique identifier |
| `buildium_gl_account_id` | INTEGER | NOT NULL, UNIQUE | - | GL account ID from Buildium |
| `account_number` | VARCHAR(50) | - | - | Account number/code |
| `name` | VARCHAR(255) | NOT NULL | - | Account name |
| `description` | TEXT | - | - | Account description |
| `type` | VARCHAR(50) | NOT NULL | - | Account type (Income, Liability, Asset, Expense, Equity) |
| `sub_type` | VARCHAR(50) | - | - | Buildium subtype (e.g., CurrentLiability) |
| `is_default_gl_account` | BOOLEAN | - | `false` | Default account flag |
| `default_account_name` | VARCHAR(255) | - | - | Default account name (if default) |
| `is_contra_account` | BOOLEAN | - | `false` | Contra-account flag |
| `is_bank_account` | BOOLEAN | - | `false` | Whether this GL is a bank account |
| `cash_flow_classification` | VARCHAR(50) | - | - | Cash flow classification |
| `exclude_from_cash_balances` | BOOLEAN | - | `false` | Exclude from cash balances |
| `is_active` | BOOLEAN | - | `true` | Active flag |
| `buildium_parent_gl_account_id` | INTEGER | - | - | Parent’s Buildium GL account ID (if this is a child) |
| `is_credit_card_account` | BOOLEAN | - | `false` | Credit card account flag |
| `created_at` | TIMESTAMPTZ | NOT NULL | `now()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | - | Update timestamp |
| `sub_accounts` | UUID[] | - | `'{}'` | Array of local UUIDs for child accounts |

**Hierarchy Model:**
- Parent/child relationships come from Buildium’s `ParentGLAccountId` field on the child.
- Locally, the parent maintains a denormalized list of its children in `sub_accounts` (UUIDs of child `gl_accounts.id`).
- The parent’s `sub_accounts` array is updated during sync when both parent and child exist locally. An index `idx_gl_accounts_sub_accounts` (GIN) supports efficient querying.

**Relationships:**
- **Self-Referential (denormalized)**: Parent → children via `sub_accounts` (UUID[]).
- **External**: `bank_accounts.gl_account` → `gl_accounts.id` (Many bank accounts can reference a GL account).

See `docs/database/current_schema.sql:2129` for the full authoritative DDL and comments.

### Vendors

**Table**: `public.vendors`

**Purpose**: Vendor information for property management services.

**Schema Definition:**
```sql
CREATE TABLE "public"."vendors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "buildium_vendor_id" integer,
    "name" character varying(255) NOT NULL,
    "category_id" integer,
    "contact_name" character varying(255),
    "email" character varying(255),
    "phone_number" character varying(50),
    "address_line1" character varying(255),
    "address_line2" character varying(255),
    "city" character varying(100),
    "state" character varying(100),
    "postal_code" character varying(20),
    "country" character varying(100),
    "tax_id" character varying(255),
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);
```

**Field Details:**

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| `id` | UUID | NOT NULL, Primary Key | `gen_random_uuid()` | Unique identifier |
| `buildium_vendor_id` | INTEGER | - | - | Buildium API vendor ID |
| `name` | VARCHAR(255) | NOT NULL | - | Vendor name |
| `category_id` | INTEGER | - | - | Category reference |
| `contact_name` | VARCHAR(255) | - | - | Contact person name |
| `email` | VARCHAR(255) | - | - | Email address |
| `phone_number` | VARCHAR(50) | - | - | Phone number |
| `address_line1` | VARCHAR(255) | - | - | Address line 1 |
| `address_line2` | VARCHAR(255) | - | - | Address line 2 |
| `city` | VARCHAR(100) | - | - | City |
| `state` | VARCHAR(100) | - | - | State |
| `postal_code` | VARCHAR(20) | - | - | Postal code |
| `country` | VARCHAR(100) | - | - | Country |
| `tax_id` | VARCHAR(255) | - | - | Tax ID |
| `notes` | TEXT | - | - | Notes |
| `is_active` | BOOLEAN | - | `true` | Active status |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL | `now()` | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NOT NULL | - | Update timestamp |

**Relationships:**
- **Many-to-One**: `vendors` → `vendor_categories` (via `category_id`)

### Tasks

**Table**: `public.tasks`

**Purpose**: Maintenance and management tasks.

**Schema Definition:**
```sql
CREATE TABLE "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" character varying(255) NOT NULL,
    "description" "text",
    "status" character varying(50) DEFAULT 'Open' NOT NULL,
    "priority" character varying(20) DEFAULT 'Medium' NOT NULL,
    "category_id" integer,
    "assigned_to" "uuid",
    "property_id" "uuid",
    "unit_id" "uuid",
    "due_date" "date",
    "completed_date" "date",
    "estimated_cost" numeric(10,2),
    "actual_cost" numeric(10,2),
    "vendor_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);
```

**Field Details:**

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| `id` | UUID | NOT NULL, Primary Key | `gen_random_uuid()` | Unique identifier |
| `title` | VARCHAR(255) | NOT NULL | - | Task title |
| `description` | TEXT | - | - | Task description |
| `status` | VARCHAR(50) | NOT NULL | `'Open'` | Task status |
| `priority` | VARCHAR(20) | NOT NULL | `'Medium'` | Task priority |
| `category_id` | INTEGER | - | - | Category reference |
| `assigned_to` | UUID | - | - | Assigned user |
| `property_id` | UUID | - | - | Property reference |
| `unit_id` | UUID | - | - | Unit reference |
| `due_date` | DATE | - | - | Due date |
| `completed_date` | DATE | - | - | Completion date |
| `estimated_cost` | NUMERIC(10,2) | - | - | Estimated cost |
| `actual_cost` | NUMERIC(10,2) | - | - | Actual cost |
| `vendor_id` | UUID | - | - | Vendor reference |
| `created_at` | TIMESTAMP WITH TIME ZONE | NOT NULL | `now()` | Creation timestamp |
| `updated_at` | TIMESTAMP WITH TIME ZONE | NOT NULL | - | Update timestamp |

**Relationships:**
- **Many-to-One**: `tasks` → `task_categories` (via `category_id`)
- **Many-to-One**: `tasks` → `properties` (via `property_id`)
- **Many-to-One**: `tasks` → `units` (via `unit_id`)
- **Many-to-One**: `tasks` → `vendors` (via `vendor_id`)

## Additional Tables

The following tables are also part of the schema but are primarily used for system operations:

- **`appliances`**: Property appliances and equipment
- **`bill_categories`**: Bill categorization
- **`buildium_api_cache`**: API response caching
- **`buildium_api_log`**: API request logging
- **`buildium_sync_status`**: Synchronization status tracking
- **`buildium_webhook_events`**: Webhook event processing
- **`inspections`**: Property inspections
- **`lease_contacts`**: Lease-tenant relationships
- **`owners_list_cache`**: Owner list caching
- **`property_ownerships_cache`**: Ownership caching
- **`rent_schedules`**: Rent payment schedules
- **`task_categories`**: Task categorization
- **`task_history`**: Task history tracking
- **`task_history_files`**: Task file attachments
- **`transaction_lines`**: Transaction line items
- **`transactions`**: Financial transactions
- **`vendor_categories`**: Vendor categorization
- **`work_orders`**: Work order management

For detailed information about these tables, refer to the current schema file: `docs/database/current_schema.sql`

## Enum Definitions

### Core Enums

#### `public.property_status`
```sql
CREATE TYPE "public"."property_status" AS ENUM (
    'Active',
    'Inactive'
);
```
**Description**: Status of a property (Active or Inactive)

#### `public.buildium_lease_status`
```sql
CREATE TYPE "public"."buildium_lease_status" AS ENUM (
    'Future',
    'Active',
    'Past',
    'Cancelled'
);
```
**Description**: Status of a lease in Buildium

#### `public.buildium_task_status`
```sql
CREATE TYPE "public"."buildium_task_status" AS ENUM (
    'Open',
    'InProgress',
    'Completed',
    'Cancelled',
    'OnHold'
);
```
**Description**: Status of a task in Buildium

#### `public.etf_account_type_enum`
```sql
CREATE TYPE "public"."etf_account_type_enum" AS ENUM (
    'Checking',
    'Savings'
);
```
**Description**: Type of ETF account

#### `public.lease_contact_role_enum`
```sql
CREATE TYPE "public"."lease_contact_role_enum" AS ENUM (
    'Tenant',
    'Cosigner',
    'Guarantor'
);
```
**Description**: Role of a contact in a lease

#### `public.lease_contact_status_enum`
```sql
CREATE TYPE "public"."lease_contact_status_enum" AS ENUM (
    'Future',
    'Active',
    'Past'
);
```
**Description**: Status of a contact in a lease

#### `public.unit_status_enum`
```sql
CREATE TYPE "public"."unit_status_enum" AS ENUM (
    'Available',
    'Occupied',
    'Maintenance',
    'Reserved'
);
```
**Description**: Status of a unit

#### `public.rent_cycle_enum`
```sql
CREATE TYPE "public"."rent_cycle_enum" AS ENUM (
    'Monthly',
    'Weekly',
    'Biweekly',
    'Quarterly',
    'Annually'
);
```
**Description**: Rent payment cycle

#### `public.transaction_type_enum`
```sql
CREATE TYPE "public"."transaction_type_enum" AS ENUM (
    'Credit',
    'Debit'
);
```
**Description**: Type of financial transaction

### Buildium-Specific Enums

#### `public.buildium_bank_account_type`
```sql
CREATE TYPE "public"."buildium_bank_account_type" AS ENUM (
    'Checking',
    'Savings',
    'Money Market',
    'Certificate of Deposit'
);
```
**Description**: Buildium bank account types

#### `public.buildium_property_type`
```sql
CREATE TYPE "public"."buildium_property_type" AS ENUM (
    'Single Family',
    'Multi Family',
    'Commercial',
    'Mixed Use'
);
```
**Description**: Buildium property types

#### `public.buildium_task_priority`
```sql
CREATE TYPE "public"."buildium_task_priority" AS ENUM (
    'Low',
    'Medium',
    'High',
    'Critical'
);
```
**Description**: Buildium task priority levels

#### `public.buildium_unit_type`
```sql
CREATE TYPE "public"."buildium_unit_type" AS ENUM (
    'Apartment',
    'Condo',
    'House',
    'Townhouse',
    'Studio'
);
```
**Description**: Buildium unit types

#### `public.buildium_vendor_category`
```sql
CREATE TYPE "public"."buildium_vendor_category" AS ENUM (
    'Maintenance',
    'Cleaning',
    'Landscaping',
    'Plumbing',
    'Electrical',
    'HVAC',
    'Roofing',
    'General Contractor'
);
```
**Description**: Buildium vendor categories

### Other Enums

#### `public.countries`
Comprehensive list of world countries. See `supabase/migrations/010_create_countries_enum.sql` for complete list.

#### `public.FeeFrequency`
```sql
CREATE TYPE "public"."FeeFrequency" AS ENUM (
    'Monthly',
    'Annually'
);
```

#### `public.FeeType`
```sql
CREATE TYPE "public"."FeeType" AS ENUM (
    'Percentage',
    'Flat Rate'
);
```

#### `public.ServicePlan`
```sql
CREATE TYPE "public"."ServicePlan" AS ENUM (
    'Full',
    'Basic',
    'A-la-carte'
);
```

For a complete list of all enum definitions, refer to the current schema file: `docs/database/current_schema.sql`

## Migration History

This section provides an overview of the database migration history and evolution.

### Migration Files

#### 001_initial_schema.sql
**Description**: Initial database schema creation

#### 002_add_is_active_to_bank_accounts.sql
**Description**: Adds an is_active boolean field to track whether bank accounts are active or inactive

#### 003_add_balance_fields_to_bank_accounts.sql
**Description**: Adds balance and buildium_balance numeric fields to track account balances

#### 004_add_gl_account_relationship_to_bank_accounts.sql
**Description**: Adds a foreign key relationship from bank_accounts to gl_accounts table

#### 005_cleanup_bank_accounts_table.sql
**Description**: Remove check printing and information fields, make key fields non-nullable

#### 006_update_gl_accounts_field_mapping.sql
**Description**: Rename parent_gl_account_id to buildium_parent_gl_account_id for proper Buildium field mapping

#### 007_add_building_name_to_units.sql
**Description**: Add building name field to units table

#### 008_standardize_timestamp_fields.sql
**Description**: Ensures all tables use consistent snake_case naming for created_at and updated_at fields

#### 009_update_units_country_to_text.sql
**Description**: Change the country field in the units table from character varying(100) to text type

#### 010_create_countries_enum.sql
**Description**: Create a comprehensive countries enum with all world countries

#### 011_apply_countries_enum_to_tables.sql
**Description**: Update all country fields to use the standardized countries enum type

#### 012_add_buildium_property_id_to_lease.sql
**Description**: Add buildium_property_id field to lease table for direct property reference

#### 013_add_buildium_unit_id_to_lease.sql
**Description**: Add buildium_unit_id field to lease table for direct unit reference

#### 20250826233007_add_sub_accounts_to_gl_accounts.sql
**Description**: Add sub_accounts field as UUID array to store child GL account references

## Current Schema Status

- **Total Migrations**: 14
- **Database Provider**: PostgreSQL via Supabase
- **ORM**: Direct Supabase client operations
- **Security**: Row Level Security (RLS) enabled on all tables

## Schema Reference Files

### Primary Documentation
- **`DETAILED_SCHEMA.md`** (this file) - Comprehensive field-level details with constraints, defaults, and enums
- **`SCHEMA_MANAGEMENT_WORKFLOW.md`** - Workflow guide for managing schema documentation
- **`current_schema.sql`** - Auto-generated current database schema (SQL format)

### Specialized Documentation
- **`buildium-*.md`** - Buildium-specific integration documentation
- **`supabase-*.md`** - Supabase-specific setup and query documentation
- **`table-relationships.md`** - Detailed table relationship documentation

### Auto-Generated Files
- **`src/types/database.ts`** - TypeScript types matching database schema
- **`docs/database/database-schema.md`** - Auto-generated overview (may be redundant)

## Quick Reference

### Schema Management Commands
```bash
# Generate current schema and types
npm run db:docs

# Generate current schema only
npm run db:schema

# Generate TypeScript types only
npm run db:types
```

### Key Schema Files
- **Current Schema**: `docs/database/current_schema.sql` (auto-generated)
- **TypeScript Types**: `src/types/database.ts` (auto-generated)
- **Detailed Documentation**: `docs/database/DETAILED_SCHEMA.md` (this file)
- **Workflow Guide**: `docs/database/SCHEMA_MANAGEMENT_WORKFLOW.md`

This consolidated documentation provides a single source of truth for all database schema information.

## Integration & Sync Tables

### Sync Operations

- Table: `public.sync_operations`
- Purpose: Tracks outbound/inbound Buildium sync operations for error recovery, retries, and auditing.

Schema Definition:
```sql
CREATE TABLE IF NOT EXISTS sync_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(10) NOT NULL CHECK (type IN ('CREATE', 'UPDATE', 'DELETE')),
  entity VARCHAR(20) NOT NULL CHECK (entity IN ('property', 'unit', 'lease', 'tenant', 'contact', 'owner')),
  buildium_id INTEGER NOT NULL,
  local_id UUID,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'ROLLED_BACK')),
  data JSONB NOT NULL,
  dependencies TEXT[],
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sync_operations_status ON sync_operations(status);
CREATE INDEX IF NOT EXISTS idx_sync_operations_entity_buildium_id ON sync_operations(entity, buildium_id);
CREATE INDEX IF NOT EXISTS idx_sync_operations_created_at ON sync_operations(created_at);

-- RLS
ALTER TABLE sync_operations ENABLE ROW LEVEL SECURITY;
```

Field Details:

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| `id` | UUID | PK, NOT NULL | `gen_random_uuid()` | Unique identifier for the operation |
| `type` | VARCHAR(10) | NOT NULL, CHECK | - | Operation type: `CREATE`, `UPDATE`, `DELETE` |
| `entity` | VARCHAR(20) | NOT NULL, CHECK | - | Entity being synced: `property`, `unit`, `lease`, `tenant`, `contact`, `owner` |
| `buildium_id` | INTEGER | NOT NULL | - | Target/source Buildium entity ID |
| `local_id` | UUID | - | - | Local DB entity ID (once available) |
| `status` | VARCHAR(20) | NOT NULL, CHECK | `'PENDING'` | `PENDING`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `ROLLED_BACK` |
| `data` | JSONB | NOT NULL | - | Original payload/response data for auditing and retries |
| `dependencies` | TEXT[] | - | - | Operation IDs that must complete first |
| `error` | TEXT | - | - | Error message for failed attempts |
| `attempts` | INTEGER | NOT NULL | `0` | Number of retry attempts |
| `last_attempt` | TIMESTAMPTZ | - | `now()` | Timestamp of last attempt |
| `created_at` | TIMESTAMPTZ | - | `now()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | - | `now()` | Update timestamp |

Relationships:
- None at this time. This table deliberately has no foreign keys to avoid blocking retries and allow cross-entity workflows.
