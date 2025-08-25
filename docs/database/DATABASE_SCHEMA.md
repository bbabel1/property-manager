# Database Schema Documentation

> **Last Updated**: January 2025 (Auto-generated)

## Overview

This document provides a comprehensive overview of the Supabase database schema for the Ora Property Management system.

## Migration History

### 001_create_properties_table.sql

**Description**: Creates the Properties table with country and rental_sub_type enums

### 002_create_units_table.sql

**Description**: Creates the Units table with bedroom and bathroom enums, and proper relationships to Properties

### 003_update_owners_and_create_ownership.sql

**Description**: Updates the Owner table to "owners" with comprehensive fields and creates Ownership join table for many-to-many relationships

### 004_create_bank_accounts_table.sql

**Description**: Creates the bank_accounts table with bank account types and check layout types

### 005_add_primary_owner_to_properties.sql

**Description**: Adds primary_owner field to properties table

## Current Schema Status

- **Total Migrations**: 5
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
