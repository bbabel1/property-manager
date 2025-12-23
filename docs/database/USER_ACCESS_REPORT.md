# User Access Report for [brandon@managedbyora.com][contact-email]

**Date**: 2025-01-31  
**User ID**: `e4800813-a9ee-494a-a6a3-7f2d3cae6257`

---

## Executive Summary

**[brandon@managedbyora.com][contact-email] CAN access the platform because of TWO RLS policies that grant access:**

1. ✅ **`properties_org_member_read`** - Checks `org_memberships` table
2. ✅ **`properties_org_read`** - Uses `is_org_member()` helper function

Both policies evaluate to TRUE because the user has a record in `org_memberships` linking them to
"Ora Property Management" organization.

**The new RBAC system (roles/permissions) is NOT required for basic access** - it's only needed for
granular permission checks.

---

## Detailed Findings

### 1. User Authentication ✅

- **Email**: [brandon@managedbyora.com][contact-email]
- **Status**: Active, email confirmed
- **Last sign in**: December 14, 2025
- **Created**: September 19, 2025

### 2. Organization Membership ✅

**User IS a member of an organization:**

- **Organization**: Ora Property Management (`ora-property-management`)
- **Org ID**: `1e1b1bc6-a9a1-4306-8bc9-e6110cd10cc3`
- **Buildium Org ID**: 514306
- **Membership created**: September 19, 2025

**This is the KEY reason the user can access the platform.**

### 3. RBAC Role Assignment ❌

**User has NO roles assigned in the new RBAC system:**

- No records in `membership_roles` table
- This means no granular permissions via the RBAC system
- **However**: This doesn't block access because the RLS policies use `org_memberships`, not `membership_roles`

### 4. Available Roles in System ✅

**6 system roles exist** (but not assigned to the user):

- Developer (Full access to all actions)
- Owner Portal (Owner portal default)
- Staff - Manager (Full staff access)
- Staff - Standard (Read/edit without approvals)
- Tenant Portal (Tenant portal default)
- Vendor Portal (Vendor portal default)

### 5. Organizations in System ✅

**2 organizations exist:**

1. Default Organization (default) - Not linked to Buildium
2. Ora Property Management (ora-property-management) - Linked to Buildium org 514306

---

## How Access Works: RLS Policy Analysis

### Properties Table - 5 Active Policies

#### Policy 1: `properties_org_member_read` ✅ GRANTS ACCESS

```sql
USING: EXISTS (
  SELECT 1 FROM org_memberships m
  WHERE m.user_id = auth.uid()
    AND m.org_id = properties.org_id
)
```

**Result**: ✅ TRUE - User has org_membership for Ora Property Management

#### Policy 2: `properties_org_read` ✅ GRANTS ACCESS

```sql
USING: is_org_member(auth.uid(), org_id)
```

**Result**: ✅ TRUE - Helper function checks org_memberships (with fallback logic)

#### Policy 3: `properties_org_write`

```sql
WITH CHECK: is_org_admin_or_manager(auth.uid(), org_id)
```

**Result**: ❓ UNKNOWN - Depends on whether user has admin/manager role

#### Policy 4: `properties_org_update`

```sql
USING: is_org_admin_or_manager(auth.uid(), org_id)
```

**Result**: ❓ UNKNOWN - Depends on whether user has admin/manager role

#### Policy 5: `properties_visible_to_owner`

```sql
USING: EXISTS (
  SELECT 1 FROM ownerships po
  JOIN owners o ON o.id = po.owner_id
  WHERE po.property_id = properties.id
    AND o.user_id = auth.uid()
)
```

**Result**: ❓ UNKNOWN - Depends on whether user is linked to an owner record

---

## Why User Can Navigate the Platform

### ✅ READ Access Granted By

1. **`org_memberships` record exists** for "Ora Property Management"
2. **RLS policies check `org_memberships`**, not `membership_roles`
3. **Helper function `is_org_member()`** has this logic:

   ```sql
   -- First check: membership_roles (new RBAC)
   -- Fallback: org_memberships (legacy)
   ```

   Since `org_memberships` has a record, the fallback grants access

### ❓ WRITE/UPDATE Access

**Unknown** - Depends on:

- Whether `is_org_admin_or_manager()` returns TRUE
- This function likely checks for admin/manager roles
- User has NO `membership_roles`, so this probably returns FALSE
- **User likely has READ-ONLY access**

---

## Architecture – Two-Tier Access System

### Tier 1: Organization Membership (Currently Active)

**Table**: `org_memberships`  
**Purpose**: "Can this user access this organization at all?"  
**Status**: ✅ Working - User has membership

### Tier 2: Role-Based Permissions (Not Active for This User)

**Tables**: `membership_roles` → `roles` → `role_permissions` → `permissions`  
**Purpose**: "What specific actions can this user perform?"  
**Status**: ❌ Not assigned - User has no roles

---

## Key Insight: RBAC is Optional for Basic Access

The system is designed with **graceful degradation**:

1. **Basic access**: Requires only `org_memberships` ✅
2. **Granular permissions**: Requires `membership_roles` + RBAC ❌

This is why the user can navigate the platform even though:

- No `membership_roles` assigned
- No granular permissions configured
- RBAC system is "empty" for this user

The `is_org_member()` helper function provides the fallback:

```typescript
// Pseudo-code of helper function logic
function is_org_member(user_id, org_id) {
  // Try new RBAC system first
  if (exists in membership_roles) return true;

  // Fallback to legacy org_memberships
  if (exists in org_memberships) return true; // ← This grants access!

  return false;
}
```

---

## Recommendations

### For Development/Testing (Current State - OK)

- ✅ User can access via `org_memberships`
- ✅ Basic read access works
- ⚠️ Write access may be limited

### For Production (Need to Complete RBAC)

1. **Assign a role to the user**:

   ```sql
   -- Assign "Developer" role to the user
   INSERT INTO public.membership_roles (user_id, org_id, role_id)
   VALUES (
     'e4800813-a9ee-494a-a6a3-7f2d3cae6257',
     '1e1b1bc6-a9a1-4306-8bc9-e6110cd10cc3',
     (SELECT id FROM public.roles WHERE name = 'Developer' LIMIT 1)
   );
   ```

2. **Seed permissions** for each role (if not already done)

3. **Map role → permissions** in `role_permissions` table

4. **Test granular permission checks** using `has_permission()` function

---

## Conclusion

**[brandon@managedbyora.com][contact-email] can navigate the platform because:**

- ✅ User is authenticated
- ✅ User has `org_memberships` record for "Ora Property Management"
- ✅ RLS policies check `org_memberships` (via `is_org_member()` helper)
- ✅ The helper function's fallback logic grants access

**The RBAC system (roles/permissions) is built but not required for basic access.** It's used for
granular permission checks, which aren't enforced yet because the user has no roles assigned.

This is actually a **well-designed system** - it allows:

- Basic access via simple org membership
- Granular control via optional RBAC layer
- Graceful degradation during migration

[contact-email]: mailto:brandon@managedbyora.com
