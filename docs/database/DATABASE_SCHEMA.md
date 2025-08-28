# Database Schema Documentation

> **Last Updated**: 2025-08-28T05:34:42.966Z (Auto-generated)

## Overview

This document provides a comprehensive overview of the Supabase database schema for the Ora Property Management system.

## Migration History

### 001_initial_schema.sql
**Description**: No description available

### 002_add_is_active_to_bank_accounts.sql
**Description**: Adds an is_active boolean field to track whether bank accounts are active or inactive

### 003_add_balance_fields_to_bank_accounts.sql
**Description**: Adds balance and buildium_balance numeric fields to track account balances

### 004_add_gl_account_relationship_to_bank_accounts.sql
**Description**: Adds a foreign key relationship from bank_accounts to gl_accounts table

### 005_cleanup_bank_accounts_table.sql
**Description**: Remove check printing and information fields, make key fields non-nullable

### 006_update_gl_accounts_field_mapping.sql
**Description**: Rename parent_gl_account_id to buildium_parent_gl_account_id for proper Buildium field mapping

### 007_add_building_name_to_units.sql
**Description**: No description available

### 008_standardize_timestamp_fields.sql
**Description**: Ensures all tables use consistent snake_case naming for created_at and updated_at fields

### 009_update_units_country_to_text.sql
**Description**: Change the country field in the units table from character varying(100) to text type

### 010_create_countries_enum.sql
**Description**: Create a comprehensive countries enum with all world countries

### 011_apply_countries_enum_to_tables.sql
**Description**: Update all country fields to use the standardized countries enum type

### 012_add_buildium_property_id_to_lease.sql
**Description**: Add buildium_property_id field to lease table for direct property reference

### 013_add_buildium_unit_id_to_lease.sql
**Description**: Add buildium_unit_id field to lease table for direct unit reference

### 20250826233007_add_sub_accounts_to_gl_accounts.sql
**Description**: Add sub_accounts field as UUID array to store child GL account references

### 20250828032609_add_data_integrity_functions.sql
**Description**: No description available

### 20250828060000_non_destructive_remote_alignment.sql
**Description**: No description available

### 20250828063500_cleanup_timestamp_standardization.sql
**Description**: No description available

### 20250828070000_add_missing_updated_at_triggers.sql
**Description**: No description available

### 20250828070500_staged_country_enum_constraints_and_report.sql
**Description**: No description available


## Current Schema Status

- **Total Migrations**: 19
- **Database Provider**: PostgreSQL via Supabase
- **ORM**: Direct Supabase client operations
- **Security**: Row Level Security (RLS) enabled on all tables

## Core Tables

### Properties
- **Purpose**: Central property information
- **Relationships**: One-to-many with units, many-to-many with owners
- **Key Features**: International address support, Buildium integration

### Owners  
- **Purpose**: Property owners (individuals and companies)
- **Relationships**: Many-to-many with properties via ownership table
- **Key Features**: Tax information, separate business and personal details

### Ownership
- **Purpose**: Property-owner relationships with percentages
- **Key Features**: Ownership vs disbursement percentages, primary owner designation

### Units
- **Purpose**: Individual rental units within properties
- **Key Features**: Bedroom/bathroom classification, market rent tracking

### Bank Accounts
- **Purpose**: Financial account management
- **Key Features**: Check printing, account types, integration with properties

For detailed schema information, see the individual migration files in `supabase/migrations/`.
