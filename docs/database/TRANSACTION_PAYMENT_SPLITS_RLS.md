# Transaction Payment Splits - RLS Implementation

## Overview
This document describes the Row Level Security (RLS) policies applied to the `transaction_payment_transactions` table to ensure consistent org-scoped access control.

## Migration Applied
**File**: `supabase/migrations/20260402091000_transaction_payment_transactions_rls.sql`
**Date**: 2026-04-02

## RLS Policies

### 1. Read Policy (`transaction_payment_transactions_org_read`)
- **Operation**: SELECT
- **Access**: Org members can read payment splits for transactions in their organization
- **Implementation**: Uses `is_org_member()` helper function to check membership via parent transaction's `org_id`

### 2. Write Policy (`transaction_payment_transactions_org_write`)
- **Operation**: INSERT
- **Access**: Org admins and managers can create payment splits
- **Implementation**: Uses `is_org_admin_or_manager()` helper function
- **Roles**: `org_admin`, `org_manager`, `platform_admin`

### 3. Update Policy (`transaction_payment_transactions_org_update`)
- **Operation**: UPDATE
- **Access**: Org admins and managers can modify payment splits
- **Implementation**: Uses `is_org_admin_or_manager()` helper function
- **Roles**: `org_admin`, `org_manager`, `platform_admin`

### 4. Delete Policy (`transaction_payment_transactions_org_delete`)
- **Operation**: DELETE
- **Access**: Org admins and managers can delete payment splits
- **Implementation**: Uses `is_org_admin_or_manager()` helper function
- **Roles**: `org_admin`, `org_manager`, `platform_admin`

## Policy Design

All policies follow the same pattern as the parent `transactions` table:
- Access is scoped by the parent transaction's `org_id`
- Uses RBAC helper functions that query `membership_roles` and `roles` tables
- Prevents infinite recursion by using `SECURITY DEFINER` functions
- Consistent with other transaction-related tables (`transaction_lines`)

## Helper Functions Used

### `is_org_member(user_id, org_id)`
- Checks if a user is a member of an organization
- Returns `boolean`
- Used for read access

### `is_org_admin_or_manager(user_id, org_id)`
- Checks if a user has admin or manager role in an organization
- Returns `boolean`
- Used for write/update/delete access
- Includes roles: `org_admin`, `org_manager`, `platform_admin`

## Verification

Run the audit script to verify RLS is properly configured:

```bash
npx tsx scripts/database/audit-transaction-fields.ts
```

Expected output:
- RLS enabled: `true` for `transaction_payment_transactions`
- 4 policies present (read, write, update, delete)
- No orphaned splits
- Consistent with `transactions` table policies

## Security Considerations

1. **Cascade Delete**: The `transaction_id` foreign key has `ON DELETE CASCADE`, so splits are automatically removed when the parent transaction is deleted
2. **Org Isolation**: Users can only access splits for transactions in their organization
3. **Role-Based Writes**: Only admins and managers can create/modify/delete splits
4. **No Direct Access**: All access is mediated through the parent transaction's org membership

## Related Tables

- `transactions` - Parent table (org-scoped)
- `transaction_lines` - Sibling table (org-scoped via transaction)
- `gl_accounts` - Referenced for bank account lookups (org-scoped)
- `membership_roles` - Used by helper functions for role checks
- `roles` - Defines available roles per organization

## API/UI Impact

With RLS enabled:
- API routes automatically respect org boundaries
- UI components can safely query splits without additional filtering
- Service role bypasses RLS for admin operations (sync, backfill)
- User queries are automatically scoped to their org memberships

