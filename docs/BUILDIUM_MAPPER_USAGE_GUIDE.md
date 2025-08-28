# Buildium Mapper Usage Guide

## 🚨 Critical Issue: Missing Relationships

### The Problem
When using basic mappers instead of enhanced mappers, relationships between entities are lost:

- **Properties** lose their bank account references
- **Bank Accounts** lose their GL account references  
- **GL Accounts** lose their sub_accounts relationships

### Real Example

```typescript
// ❌ WRONG - Property created without bank account
const property = mapPropertyFromBuildium(buildiumData)
// Result: operating_bank_account_id = null (missing relationship)

// ✅ CORRECT - Property with complete bank account relationship
const property = await mapPropertyFromBuildiumWithBankAccount(buildiumData, supabase)
// Result: operating_bank_account_id = "uuid-of-bank-account" (complete relationship)
```

## 📋 Mapper Functions Reference

### Enhanced Mappers (Use These)

| Function | Purpose | Handles Relationships |
|----------|---------|---------------------|
| `mapPropertyFromBuildiumWithBankAccount()` | Property mapping | ✅ Bank accounts |
| `mapBankAccountFromBuildiumWithGLAccount()` | Bank account mapping | ✅ GL accounts |
| `mapGLAccountFromBuildiumWithSubAccounts()` | GL account mapping | ✅ Sub accounts |
| `mapLeaseFromBuildiumWithTenants()` | Lease mapping | ✅ Tenants & Contacts |

### Basic Mappers (Deprecated)

| Function | Purpose | Missing Relationships |
|----------|---------|---------------------|
| `mapPropertyFromBuildium()` | Basic property mapping | ❌ Bank accounts |
| `mapBankAccountFromBuildium()` | Basic bank account mapping | ❌ GL accounts |
| `mapGLAccountFromBuildium()` | Basic GL account mapping | ❌ Sub accounts |
| `mapLeaseFromBuildium()` | Basic lease mapping | ❌ Tenants & Contacts |

## 🔧 How Enhanced Mappers Work

### Property → Bank Account Resolution

```typescript
// Enhanced mapper automatically:
// 1. Checks if bank account exists in local database
// 2. If not found, fetches from Buildium API
// 3. Creates bank account record locally
// 4. Links property to bank account
const property = await mapPropertyFromBuildiumWithBankAccount(buildiumData, supabase)
```

### Bank Account → GL Account Resolution

```typescript
// Enhanced mapper automatically:
// 1. Checks if GL account exists in local database
// 2. If not found, fetches from Buildium API
// 3. Creates GL account record locally
// 4. Links bank account to GL account
const bankAccount = await mapBankAccountFromBuildiumWithGLAccount(buildiumData, supabase)
```

### GL Account → Sub Accounts Resolution

```typescript
// Enhanced mapper automatically:
// 1. For each sub-account ID in the array
// 2. Checks if GL account exists in local database
// 3. If not found, fetches from Buildium API
// 4. Creates GL account record locally
// 5. Links all sub-accounts to parent GL account
const glAccount = await mapGLAccountFromBuildiumWithSubAccounts(buildiumData, supabase)
```

### Lease → Tenants & Contacts Resolution

```typescript
// Enhanced mapper automatically:
// 1. Processes Tenants array and Cosigners array
// 2. For each tenant/cosigner:
//    - Finds or creates contact record by email
//    - Finds or creates tenant record by buildium_tenant_id
//    - Creates lease_contacts relationship
// 3. Handles phone numbers, country mapping, and data conversions
// 4. Returns enhanced lease data with tenant relationships
const lease = await mapLeaseFromBuildiumWithTenants(buildiumData, supabase)
```

## 🛠️ Implementation Examples

### Property Sync Script

```typescript
import { mapPropertyFromBuildiumWithBankAccount } from '@/lib/buildium-mappers'

async function syncProperty(propertyId: number) {
  // Fetch from Buildium
  const buildiumProperty = await fetchBuildiumProperty(propertyId)
  
  // ✅ Use enhanced mapper
  const localData = await mapPropertyFromBuildiumWithBankAccount(buildiumProperty, supabase)
  
  // Insert/update in database
  const { data } = await supabase
    .from('properties')
    .upsert(localData)
    .select()
    .single()
    
  return data
}
```

### Bank Account Sync Script

```typescript
import { mapBankAccountFromBuildiumWithGLAccount } from '@/lib/buildium-mappers'

async function syncBankAccount(bankAccountId: number) {
  // Fetch from Buildium
  const buildiumBankAccount = await fetchBuildiumBankAccount(bankAccountId)
  
  // ✅ Use enhanced mapper
  const localData = await mapBankAccountFromBuildiumWithGLAccount(buildiumBankAccount, supabase)
  
  // Insert/update in database
  const { data } = await supabase
    .from('bank_accounts')
    .upsert(localData)
    .select()
    .single()
    
  return data
}
```

### Lease Sync Script

```typescript
import { mapLeaseFromBuildiumWithTenants } from '@/lib/buildium-mappers'

async function syncLease(leaseId: number) {
  // Fetch from Buildium
  const buildiumLease = await fetchBuildiumLease(leaseId)
  
  // ✅ Use enhanced mapper
  const enhancedLease = await mapLeaseFromBuildiumWithTenants(buildiumLease, supabase)
  
  // Insert/update lease in database
  const leaseData = {
    ...enhancedLease,
    tenantRelationships: undefined // Remove from lease table data
  }
  
  const { data: lease } = await supabase
    .from('leases')
    .upsert(leaseData)
    .select()
    .single()
    
  // Create lease_contacts relationships
  if (enhancedLease.tenantRelationships) {
    for (const relationship of enhancedLease.tenantRelationships) {
      await createLeaseContactRelationship(
        lease.id,
        relationship.tenantId,
        relationship.role,
        supabase
      )
    }
  }
    
  return lease
}
```

## 🚨 Prevention Mechanisms

### 1. Runtime Warnings
Basic mappers show deprecation warnings in development:
```
⚠️ DEPRECATION WARNING: mapPropertyFromBuildium() is deprecated for production use.
   Use mapPropertyFromBuildiumWithBankAccount() instead to ensure proper relationship handling.
```

### 2. ESLint Rules
ESLint will catch incorrect usage and show warnings:
```
⚠️ Use mapPropertyFromBuildiumWithBankAccount() instead to ensure proper bank account relationship handling
```

### 3. TypeScript Deprecation
Basic mappers are marked with `@deprecated` JSDoc comments.

## 📚 Migration Guide

### Step 1: Identify Basic Mapper Usage

Search for these patterns:

```bash
grep -r "mapPropertyFromBuildium(" src/ scripts/
grep -r "mapBankAccountFromBuildium(" src/ scripts/
grep -r "mapGLAccountFromBuildium(" src/ scripts/
grep -r "mapLeaseFromBuildium(" src/ scripts/
```

### Step 2: Replace with Enhanced Mappers

```typescript
// Before
const data = mapPropertyFromBuildium(buildiumData)

// After
const data = await mapPropertyFromBuildiumWithBankAccount(buildiumData, supabase)

// Before
const leaseData = mapLeaseFromBuildium(buildiumData)

// After
const leaseData = await mapLeaseFromBuildiumWithTenants(buildiumData, supabase)
```

### Step 3: Update Function Signatures

```typescript
// Before
function syncProperty(buildiumData) {
  return mapPropertyFromBuildium(buildiumData)
}

// After
async function syncProperty(buildiumData, supabase) {
  return await mapPropertyFromBuildiumWithBankAccount(buildiumData, supabase)
}
```

## ✅ Best Practices

1. **Always use enhanced mappers** for production code
2. **Pass supabase client** to enhanced mappers
3. **Handle async/await** properly
4. **Test with real data** to verify relationships
5. **Use the template scripts** as starting points

## 🔍 Verification

After using enhanced mappers, verify relationships are properly set:

```typescript
// Check property has bank account
const property = await supabase
  .from('properties')
  .select('*, bank_accounts(*)')
  .eq('id', propertyId)
  .single()

console.log('Bank account linked:', !!property.operating_bank_account_id)
```

## 📞 Support

If you encounter issues with mapper usage:
1. Check the console for deprecation warnings
2. Verify you're using the correct enhanced mapper
3. Ensure supabase client is passed to enhanced mappers
4. Test with a small dataset first
