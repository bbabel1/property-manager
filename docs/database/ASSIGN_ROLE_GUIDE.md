# Quick Guide: Assign Role to brandon@managedbyora.com

**Date**: 2025-01-31

---

## ✅ Updated Memberships Page Now Fetches Roles Dynamically

The `/settings/memberships` page has been updated to fetch roles from the database instead of using hardcoded values.

---

## 🚀 How to Assign a Role

### Step 1: Navigate to Memberships Page

Open your browser and go to:

```
http://localhost:3000/settings/memberships
```

### Step 2: Use Quick Assign Section

In the "Quick Assign" card, you'll see three dropdowns:

1. **User Dropdown**
   - Select: `brandon@managedbyora.com`

2. **Organization Dropdown**
   - Select: `Ora Property Management`

3. **Role Dropdown** (Now Dynamic!)
   - You'll see 6 roles from the database:
     - **Developer** ← Recommended (full access)
     - Staff - Manager
     - Staff - Standard
     - Owner Portal
     - Tenant Portal
     - Vendor Portal
   - Each role shows its description
   - Select: **Developer**

### Step 3: Click "Assign Membership"

This will:

1. ✅ Update/confirm `org_memberships` record (already exists)
2. ✅ Create `membership_roles` record with "Developer" role
3. ✅ Grant full access permissions via RBAC system

---

## 🎯 What Happens Behind the Scenes

### API Call

```json
POST /api/admin/memberships/simple
{
  "user_id": "e4800813-a9ee-494a-a6a3-7f2d3cae6257",
  "org_id": "1e1b1bc6-a9a1-4306-8bc9-e6110cd10cc3",
  "role": "Developer"
}
```

### Database Operations

```sql
-- 1. Upsert org_memberships
INSERT INTO public.org_memberships (user_id, org_id)
VALUES ('e4800813-a9ee-494a-a6a3-7f2d3cae6257', '1e1b1bc6-a9a1-4306-8bc9-e6110cd10cc3')
ON CONFLICT (user_id, org_id) DO NOTHING;

-- 2. Look up role ID
SELECT id FROM public.roles WHERE name = 'Developer' LIMIT 1;
-- Returns: (some UUID)

-- 3. Delete old role assignments for this user/org
DELETE FROM public.membership_roles
WHERE user_id = 'e4800813-a9ee-494a-a6a3-7f2d3cae6257'
  AND org_id = '1e1b1bc6-a9a1-4306-8bc9-e6110cd10cc3';

-- 4. Insert new role assignment
INSERT INTO public.membership_roles (user_id, org_id, role_id)
VALUES ('e4800813-a9ee-494a-a6a3-7f2d3cae6257', '1e1b1bc6-a9a1-4306-8bc9-e6110cd10cc3', (role UUID));
```

---

## ✅ Verification

### Check in UI

1. After assignment, the "Existing Memberships" table should show:
   - User: `brandon@managedbyora.com`
   - Organization: `Ora Property Management`
   - Role: `Developer` (badge)

### Check in Database

Run this query to verify:

```sql
SELECT
  u.email,
  o.name as org_name,
  r.name as role_name,
  r.description as role_description,
  mr.created_at as assigned_at
FROM public.membership_roles mr
JOIN auth.users u ON u.id = mr.user_id
JOIN public.organizations o ON o.id = mr.org_id
JOIN public.roles r ON r.id = mr.role_id
WHERE u.email = 'brandon@managedbyora.com';
```

**Expected Result**:

```
email                    | org_name                | role_name | role_description          | assigned_at
-------------------------|-------------------------|-----------|---------------------------|-------------
brandon@managedbyora.com | Ora Property Management | Developer | Full access to all actions| 2025-01-31...
```

---

## 🎨 UI Improvements Made

### 1. Dynamic Role Loading

- Roles are fetched from `/api/admin/permission-profiles`
- Shows all roles from `roles` table
- Updates automatically when roles change

### 2. Role Descriptions

- Each role shows its description in the dropdown
- Helper text appears below dropdown when role is selected
- Helps users understand what each role does

### 3. Smart Defaults

- Automatically selects first non-portal role (Developer or Staff - Manager)
- Avoids defaulting to portal roles which are for external users

### 4. Loading States

- Shows "Loading roles..." while fetching
- Prevents assignment until roles are loaded

---

## 🔍 What This Fixes

### Before Update

❌ User saw hardcoded roles that might not match database  
❌ "org_staff" role might not exist in database  
❌ No way to know what each role does  
❌ Had to update code to add new roles

### After Update

✅ User sees actual roles from database  
✅ Roles are guaranteed to exist  
✅ Role descriptions help with selection  
✅ New roles appear automatically

---

## 📋 Next Steps

### Immediate (Can Do Now)

1. ✅ Navigate to `/settings/memberships`
2. ✅ Assign "Developer" role to brandon@managedbyora.com
3. ✅ Verify role appears in "Existing Memberships" table

### Future Enhancements

- [ ] Build role management UI to create/edit roles
- [ ] Build permission management UI to assign permissions to roles
- [ ] Show actual permissions for each role in memberships page
- [ ] Add ability to assign multiple roles to one user
- [ ] Add role filtering (show only relevant roles per org)

---

## 🎉 Summary

**The memberships page now dynamically fetches roles from the `roles` table**, making it easy to:

- Assign roles to users
- See available roles and their descriptions
- Ensure role assignments are valid
- Manage RBAC without code changes

**brandon@managedbyora.com can now be assigned a proper role** through the UI, which will grant appropriate permissions via the RBAC system.
