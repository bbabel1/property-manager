# Buildium GL Accounts Field Mapping

This document outlines the field mapping between Buildium API GL accounts and the local database `gl_accounts` table.

## Field Mapping Table

| Buildium Field | Local Database Field | Type | Required | Description |
|----------------|---------------------|------|----------|-------------|
| `Id` | `buildium_gl_account_id` | INTEGER | ✅ | Buildium API GL account ID |
| `AccountNumber` | `account_number` | VARCHAR(50) | ❌ | Account number |
| `Name` | `name` | VARCHAR(255) | ✅ | Account name |
| `Description` | `description` | TEXT | ❌ | Account description |
| `Type` | `type` | VARCHAR(50) | ✅ | Account type (Income, Liability, Asset, Expense, Equity) |
| `SubType` | `sub_type` | VARCHAR(50) | ❌ | Account subtype (CurrentLiability, Income, etc.) |
| `IsDefaultGLAccount` | `is_default_gl_account` | BOOLEAN | ❌ | Whether this is a default GL account |
| `DefaultAccountName` | `default_account_name` | VARCHAR(255) | ❌ | Default account name |
| `IsContraAccount` | `is_contra_account` | BOOLEAN | ❌ | Whether this is a contra account |
| `IsBankAccount` | `is_bank_account` | BOOLEAN | ❌ | Whether this is a bank account |
| `CashFlowClassification` | `cash_flow_classification` | VARCHAR(50) | ❌ | Cash flow classification |
| `ExcludeFromCashBalances` | `exclude_from_cash_balances` | BOOLEAN | ❌ | Whether to exclude from cash balances |
| `IsActive` | `is_active` | BOOLEAN | ❌ | Whether the account is active |
| `ParentGLAccountId` | `buildium_parent_gl_account_id` | INTEGER | ❌ | Buildium API parent GL account ID |
| `IsCreditCardAccount` | `is_credit_card_account` | BOOLEAN | ❌ | Whether this is a credit card account |

## Data Transformation Notes

### Required Fields
- `buildium_gl_account_id` and `name` are NOT NULL in the database
- These fields must always have values when creating GL account records

### Optional Fields
- All other fields can be NULL
- Default values are applied where appropriate (e.g., `is_active` defaults to `true`)

### Field Naming Convention
- Buildium uses PascalCase (e.g., `IsActive`)
- Local database uses snake_case (e.g., `is_active`)
- Buildium IDs are prefixed with `buildium_` in local database

### Parent Account Relationship
- `ParentGLAccountId` maps to `buildium_parent_gl_account_id`
- This maintains the hierarchical relationship between GL accounts
- Parent accounts must exist in Buildium before child accounts can reference them

## Usage Examples

### Creating a GL Account Record
```typescript
const glAccountData = {
  buildium_gl_account_id: buildiumGLAccount.Id,
  account_number: buildiumGLAccount.AccountNumber,
  name: buildiumGLAccount.Name,
  description: buildiumGLAccount.Description,
  type: buildiumGLAccount.Type,
  sub_type: buildiumGLAccount.SubType,
  is_default_gl_account: buildiumGLAccount.IsDefaultGLAccount,
  default_account_name: buildiumGLAccount.DefaultAccountName,
  is_contra_account: buildiumGLAccount.IsContraAccount,
  is_bank_account: buildiumGLAccount.IsBankAccount,
  cash_flow_classification: buildiumGLAccount.CashFlowClassification,
  exclude_from_cash_balances: buildiumGLAccount.ExcludeFromCashBalances,
  is_active: buildiumGLAccount.IsActive,
  buildium_parent_gl_account_id: buildiumGLAccount.ParentGLAccountId,
  is_credit_card_account: buildiumGLAccount.IsCreditCardAccount,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}
```

### Querying GL Accounts
```sql
-- Get all active GL accounts
SELECT * FROM gl_accounts WHERE is_active = true;

-- Get GL accounts by type
SELECT * FROM gl_accounts WHERE type = 'Asset';

-- Get parent-child relationships
SELECT 
  parent.name as parent_name,
  child.name as child_name
FROM gl_accounts parent
JOIN gl_accounts child ON parent.buildium_gl_account_id = child.buildium_parent_gl_account_id;
```

## Migration History

- **Migration 006**: Renamed `parent_gl_account_id` to `buildium_parent_gl_account_id` to match Buildium field naming convention
