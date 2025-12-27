# RBAC UI Management Guide

<!-- markdownlint-configure-file {"MD060": false, "MD013": false} -->

**Date**: 2025-12-20

## Overview

This document maps the RBAC database tables to their UI management interfaces and identifies gaps.

---

## 🎯 Current UI Pages for RBAC Management

### 1. Settings Hub

**URL**: `/settings`
**Purpose**: Main settings navigation
**Features**:

- Links to all settings pages
- "Team & Roles" section with links to:
  - `/settings/users` - Users & Roles
  - `/settings/memberships` - Quick assign

---

### 2. Organization Settings

**URL**: `/settings/organization`
**Database Table**: `organizations`
**Status**: ✅ Connected (manager API)

**Mapped Fields (organizations table)**:

- ✅ CompanyName/name + public_id (display)
- ✅ Url
- ✅ Contact: FirstName, LastName, PhoneNumber
- ✅ Contact address: AddressLine1/2/3, City, State, PostalCode, Country
- ✅ AccountingSettings: AccountingBookId, DefaultBankAccountId, DefaultAccountingBasis,
  TrustAccountWarning, FiscalYearEndMonth, FiscalYearEndDay

**API Endpoint**: `/api/organization` (GET, PATCH) - internal scope

---

### 3. Memberships Management

**URL**: `/settings/memberships`
**Database Tables**: `org_memberships` + `membership_roles`
**Status**: ✅ EXISTS (Partially Complete)

**Current Features**:

- ✅ View all users and their org memberships
- ✅ Assign user to organization with role
- ✅ Remove user from organization
- ✅ Role selection dropdown

**Current Role Options** (Hardcoded):

```typescript
const ROLE_OPTIONS = [
  { label: 'Org Staff', value: 'org_staff' },
  { label: 'Property Manager', value: 'org_manager' },
  { label: 'Org Admin', value: 'org_admin' },
  { label: 'Platform Admin', value: 'platform_admin' },
  { label: 'Owner Portal', value: 'owner_portal' },
  { label: 'Tenant Portal', value: 'tenant_portal' },
  { label: 'Vendor Portal', value: 'vendor_portal' },
];
```

**API Endpoints**:

- ✅ `POST /api/admin/memberships/simple` - Assign membership + role
- ✅ `DELETE /api/admin/memberships/simple` - Remove membership + role

**What It Does**:

1. Creates/updates `org_memberships` record
2. **Also creates `membership_roles` record** (lines 91-110 in route.ts)
3. Looks up role by name from `roles` table
4. Syncs both tables automatically

**Gaps**:

- ❌ No way to assign multiple roles to one user
- ❌ No way to view actual permissions for each role
- ❌ Roles are hardcoded in UI, not fetched from `roles` table
- ❌ No validation that selected role exists in database

---

### 4. Users & Roles Management

**URL**: `/settings/users`
**Database Tables**: `profiles`, `contacts`, `staff`, `org_memberships`
**Status**: ✅ EXISTS (Complex, Multi-Purpose)

**Current Features**:

- ✅ View all users with their contact info
- ✅ Invite new users
- ✅ Edit user details
- ✅ Assign user types (staff, rental_owner, vendor)
- ✅ View memberships per user

**Role Options** (Different from memberships page):

```typescript
const ROLE_OPTIONS = [
  { label: 'Administrator', key: 'admin' },
  { label: 'Property Manager', key: 'property_manager' },
  { label: 'Rental Owner', key: 'rental_owner' },
  { label: 'Vendor', key: 'vendor' },
];
```

**Gaps**:

- ❌ Roles here don't match the `roles` table
- ❌ No connection to `membership_roles` table
- ❌ No permission management

---

### 5. Permission Profiles (Admin API Only)

**URL**: No UI page exists
**Database Tables**: `roles`, `role_permissions`, `permissions`
**Status**: ⚠️ API EXISTS, NO UI

**API Endpoints**:

- ✅ `GET /api/admin/permission-profiles` - List all roles with permissions
- ✅ `POST /api/admin/permission-profiles` - Create/update role with permissions
- ✅ `POST /api/admin/permission-profiles/assign` - Assign profile to user

**What It Does**:

- Queries `roles` table (aliased as permission_profiles)
- Joins with `role_permissions` → `permissions`
- Returns roles with their permission lists
- Can create/update roles with permission sets

**Missing**:

- ❌ **No UI page to manage roles**
- ❌ **No UI to view/edit permissions**
- ❌ **No UI to assign roles to users** (except via memberships page)

---

## 📋 Database Table → UI Mapping

| Database Table     | UI Page                  | Status      | Notes                                                    |
| ------------------ | ------------------------ | ----------- | -------------------------------------------------------- |
| `organizations`    | `/settings/organization` | ✅ Working  | Backed by /api/organization (profile/contact/accounting) |
| `org_memberships`  | `/settings/memberships`  | ✅ Working  | Can assign/remove memberships                            |
| `membership_roles` | `/settings/memberships`  | ✅ Working  | Auto-synced when assigning membership                    |
| `roles`            | ❌ No UI                 | ⚠️ API Only | Need UI to manage role definitions                       |
| `role_permissions` | ❌ No UI                 | ⚠️ API Only | Need UI to map roles → permissions                       |
| `permissions`      | ❌ No UI                 | ⚠️ API Only | Need UI to manage permission catalog                     |
| `profiles`         | `/settings/profile`      | ✅ Working  | User profile management                                  |

---

## 🔧 What's Working vs What's Missing

### ✅ Working Features

1. **Assign user to organization** (`/settings/memberships`)
   - Creates `org_memberships` record ✅
   - Creates `membership_roles` record ✅
   - Looks up role from `roles` table ✅

2. **View memberships** (`/settings/memberships`)
   - Shows all users and their org memberships ✅
   - Shows assigned roles ✅

3. **Remove memberships** (`/settings/memberships`)
   - Deletes from both `org_memberships` and `membership_roles` ✅

### ❌ Missing Features

1. **Role Management UI**
   - No page to view all roles in `roles` table
   - No page to create/edit/delete roles
   - No page to view role descriptions
   - Roles are hardcoded in UI dropdowns

2. **Permission Management UI**
   - No page to view all permissions in `permissions` table
   - No page to create/edit/delete permissions
   - No page to see what each permission does

3. **Role-Permission Mapping UI**
   - No page to assign permissions to roles
   - No page to view which permissions each role has
   - Must use API directly or database queries

4. **Organization Management**
   - Organization settings page exists but not connected to database
   - Can't edit org slug, buildium_org_id, etc.

5. **Multi-Role Assignment**
   - Can only assign ONE role per user per org
   - No UI to assign multiple roles to same user

---

## 🎨 Recommended UI Pages to Build

### Priority 1: Role Management

**Page**: `/settings/roles` (NEW)
**Purpose**: Manage role definitions

**Features Needed**:

- List all roles (system + org-specific)
- Create new role
- Edit role (name, description)
- Delete role (with warning if users have it)
- View which users have each role
- Assign permissions to role (see Priority 2)

**API Endpoints** (Already exist):

- `GET /api/admin/permission-profiles` ✅
- `POST /api/admin/permission-profiles` ✅

---

### Priority 2: Permission Management

**Page**: `/settings/roles/[roleId]/permissions` (NEW)
**Purpose**: Manage permissions for a specific role

**Features Needed**:

- View all available permissions (from `permissions` table)
- Check/uncheck permissions for this role
- Save changes to `role_permissions` table
- Group permissions by category (properties, leases, financials, etc.)

**API Endpoints** (Partially exist):

- `GET /api/admin/permission-profiles` - Returns permissions ✅
- `POST /api/admin/permission-profiles` - Updates permissions ✅
- Need: `GET /api/permissions` - List all available permissions

---

### Priority 3: Enhanced Memberships Page

**Page**: `/settings/memberships` (ENHANCE EXISTING)

**Current Issues**:

- Role dropdown is hardcoded
- Can't assign multiple roles
- Can't see actual permissions

**Enhancements Needed**:

1. **Fetch roles from database** instead of hardcoded list

   ```typescript
   // Current: Hardcoded
   const ROLE_OPTIONS = [...]

   // Needed: Fetch from API
   const { data: roles } = await fetch('/api/admin/permission-profiles')
   ```

2. **Show actual permissions** for selected role
   - When user selects a role, show what permissions it grants

3. **Multi-role assignment** (optional)
   - Allow assigning multiple roles to same user

---

### Priority 4: Organization Settings

**Page**: `/settings/organization` (ENHANCE EXISTING)

**Current Issues**:

- Values are hardcoded
- Not connected to database

**Enhancements Needed**:

1. **Fetch organization data** from database

   ```typescript
   // Needed: GET /api/organizations
   ```

2. **Save updates** to database

   ```typescript
   // Connected: PATCH /api/organization
   ```

3. **Show additional fields**:
   - Organization slug (read-only or editable)
   - Buildium org ID (display, link status)
   - Organization ID (display only)

---

## 🔌 API Endpoints Status

### Existing Endpoints ✅

| Endpoint                                | Method | Purpose                     | Status     |
| --------------------------------------- | ------ | --------------------------- | ---------- |
| `/api/organization`                     | GET    | Get org details             | ✅ Working |
| `/api/organization`                     | PATCH  | Update org profile          | ✅ Working |
| `/api/organization/members`             | GET    | List org memberships        | ✅ Working |
| `/api/organizations`                    | POST   | Create organization         | ✅ Working |
| `/api/admin/memberships/simple`         | POST   | Assign membership + role    | ✅ Working |
| `/api/admin/memberships/simple`         | DELETE | Remove membership           | ✅ Working |
| `/api/admin/permission-profiles`        | GET    | List roles with permissions | ✅ Working |
| `/api/admin/permission-profiles`        | POST   | Create/update role          | ✅ Working |
| `/api/admin/permission-profiles/assign` | POST   | Assign role to user         | ✅ Exists  |

### Missing Endpoints ❌

| Endpoint           | Method | Purpose              | Needed For                  |
| ------------------ | ------ | -------------------- | --------------------------- |
| `/api/permissions` | GET    | List all permissions | Permission management UI    |
| `/api/permissions` | POST   | Create permission    | Permission management UI    |
| `/api/roles`       | GET    | List all roles       | Dynamic role dropdown       |
| `/api/roles/[id]`  | GET    | Get role details     | Role edit page              |
| `/api/roles/[id]`  | DELETE | Delete role          | Role management             |
| `/api/admin/users` | GET    | List all users       | ✅ Used by memberships page |
| `/api/admin/orgs`  | GET    | List all orgs        | ✅ Used by memberships page |

---

## 🎯 Quick Start: How to Manage RBAC Today

### For `brandon@managedbyora.com`

1. Go to **`/settings/memberships`**
2. Select user: `brandon@managedbyora.com`
3. Select org: `Ora Property Management`
4. Select role: `Org Admin` or `Platform Admin`
5. Click "Assign Membership"

**This will**:

- ✅ Create/update `org_memberships` record (already exists)
- ✅ Create `membership_roles` record with the selected role
- ✅ Grant proper permissions based on role

#### Option 2: Direct Database (If UI doesn't work)

```sql
-- Assign "Developer" role to brandon@managedbyora.com
INSERT INTO public.membership_roles (user_id, org_id, role_id)
VALUES (
  'e4800813-a9ee-494a-a6a3-7f2d3cae6257',
  '1e1b1bc6-a9a1-4306-8bc9-e6110cd10cc3',
  (SELECT id FROM public.roles WHERE name = 'Developer' LIMIT 1)
)
ON CONFLICT (user_id, org_id, role_id) DO NOTHING;
```

---

## 🚧 Missing UI Components to Build

### 1. Role Management Page (`/settings/roles`)

**Component**: `src/app/(protected)/settings/roles/page.tsx`
**Purpose**: CRUD for roles
**Fields to expose**:

- `roles.name` - Role name
- `roles.description` - Role description
- `roles.is_system` - System vs org-specific
- `roles.org_id` - Which org (null = system)

### 2. Permission Assignment Page (`/settings/roles/[id]/permissions`)

**Component**: `src/app/(protected)/settings/roles/[id]/permissions/page.tsx`
**Purpose**: Assign permissions to a role
**Fields to expose**:

- Checkboxes for all permissions from `permissions` table
- Grouped by category
- Save to `role_permissions` table

### 3. Permission Catalog Page (`/settings/permissions`)

**Component**: `src/app/(protected)/settings/permissions/page.tsx`
**Purpose**: View/manage available permissions
**Fields to expose**:

- `permissions.key` - Permission key
- `permissions.description` - What it does
- `permissions.category` - Group (properties, leases, financials)
- `permissions.is_system` - System vs org-specific

### 4. Enhanced Organization Page

**Component**: Update `src/app/(protected)/settings/organization/page.tsx`
**Purpose**: Connect to actual database
**New API Endpoints Needed**:

- `GET /api/organizations` - Fetch current org
- `PATCH /api/organizations/[id]` - Update org

---

## 📊 Field Mapping Reference

### Organizations Table → UI

| Database Field    | UI Label          | Input Type   | Page                     | Status       |
| ----------------- | ----------------- | ------------ | ------------------------ | ------------ |
| `id`              | Organization ID   | Display only | `/settings/organization` | ❌ Missing   |
| `name`            | Organization Name | Text input   | `/settings/organization` | ⚠️ Hardcoded |
| `slug`            | URL Slug          | Text input   | `/settings/organization` | ❌ Missing   |
| `buildium_org_id` | Buildium Org ID   | Display only | `/settings/organization` | ❌ Missing   |
| `created_at`      | Created           | Display only | `/settings/organization` | ❌ Missing   |
| `updated_at`      | Last Updated      | Display only | `/settings/organization` | ❌ Missing   |

### Org_Memberships Table → UI

| Database Field | UI Label     | Input Type | Page                    | Status     |
| -------------- | ------------ | ---------- | ----------------------- | ---------- |
| `user_id`      | User         | Dropdown   | `/settings/memberships` | ✅ Working |
| `org_id`       | Organization | Dropdown   | `/settings/memberships` | ✅ Working |
| `created_at`   | Joined       | Display    | `/settings/memberships` | ❌ Missing |
| `updated_at`   | Updated      | Display    | `/settings/memberships` | ❌ Missing |

### Membership_Roles Table → UI

| Database Field | UI Label     | Input Type  | Page                    | Status            |
| -------------- | ------------ | ----------- | ----------------------- | ----------------- |
| `user_id`      | User         | (inherited) | `/settings/memberships` | ✅ Working        |
| `org_id`       | Organization | (inherited) | `/settings/memberships` | ✅ Working        |
| `role_id`      | Role         | Dropdown    | `/settings/memberships` | ⚠️ Hardcoded list |
| `created_at`   | Assigned     | Display     | `/settings/memberships` | ❌ Missing        |
| `updated_at`   | Updated      | Display     | `/settings/memberships` | ❌ Missing        |

### Roles Table → UI

| Database Field | UI Label     | Input Type   | Page       | Status     |
| -------------- | ------------ | ------------ | ---------- | ---------- |
| `id`           | Role ID      | Display only | ❌ No page | ❌ Missing |
| `org_id`       | Organization | Dropdown     | ❌ No page | ❌ Missing |
| `name`         | Role Name    | Text input   | ❌ No page | ❌ Missing |
| `description`  | Description  | Textarea     | ❌ No page | ❌ Missing |
| `is_system`    | System Role  | Checkbox     | ❌ No page | ❌ Missing |

### Permissions Table → UI

| Database Field | UI Label          | Input Type   | Page       | Status     |
| -------------- | ----------------- | ------------ | ---------- | ---------- |
| `id`           | Permission ID     | Display only | ❌ No page | ❌ Missing |
| `org_id`       | Organization      | Dropdown     | ❌ No page | ❌ Missing |
| `key`          | Permission Key    | Text input   | ❌ No page | ❌ Missing |
| `description`  | Description       | Textarea     | ❌ No page | ❌ Missing |
| `category`     | Category          | Dropdown     | ❌ No page | ❌ Missing |
| `is_system`    | System Permission | Checkbox     | ❌ No page | ❌ Missing |

### Role_Permissions Table → UI

| Database Field  | UI Label   | Input Type | Page       | Status     |
| --------------- | ---------- | ---------- | ---------- | ---------- |
| `role_id`       | Role       | (context)  | ❌ No page | ❌ Missing |
| `permission_id` | Permission | Checkboxes | ❌ No page | ❌ Missing |

---

## 🚀 Immediate Action Items

### To Assign Roles to `brandon@managedbyora.com`

**Option A: Use Existing UI** (Easiest)

1. Navigate to:
   [http://localhost:3000/settings/memberships](http://localhost:3000/settings/memberships)
2. In "Quick Assign" section:
   - User: Select `brandon@managedbyora.com`
   - Organization: Select `Ora Property Management`
   - Role: Select `Org Admin` or `Platform Admin`
3. Click "Assign Membership"

**Result**: This will create the `membership_roles` record and grant proper access.

**Option B: Use API Directly**

Set `API_URL` to your instance (for local dev: use
[local memberships endpoint](http://localhost:3000/api/admin/memberships/simple))
and run:

```bash
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "e4800813-a9ee-494a-a6a3-7f2d3cae6257",
    "org_id": "1e1b1bc6-a9a1-4306-8bc9-e6110cd10cc3",
    "role": "org_admin"
  }'
```

### To Build Missing UI

**Priority Order**:

1. **Fix Organization Settings** - Connect to database (1-2 hours)
2. **Build Role Management Page** - CRUD for roles (4-6 hours)
3. **Build Permission Assignment** - Map permissions to roles (6-8 hours)
4. **Build Permission Catalog** - View/manage permissions (4-6 hours)

---

## 📝 Summary

**Current State**:

- ✅ `/settings/memberships` page **WORKS** and can assign roles
- ✅ API endpoints exist for role/permission management
- ❌ No UI for managing roles, permissions, or role-permission mappings
- ⚠️ Organization settings page is not connected to database

**To manage RBAC today**:

1. Use `/settings/memberships` to assign users to orgs with roles ✅
2. Use API endpoints directly for role/permission management
3. Use database queries for advanced RBAC configuration

**To complete RBAC UI**:

- Build role management page
- Build permission management page
- Connect organization settings to database
- Enhance memberships page to show actual permissions
