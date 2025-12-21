# RBAC UI Update Summary

**Date**: 2025-01-31  
**Changes**: Dynamic role fetching in memberships page

---

## ✅ Changes Made

### Updated: `/settings/memberships` Page

**File**: `src/app/(protected)/settings/memberships/page.tsx`

#### 1. Removed Hardcoded Roles

**Before**:

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

**After**: Removed hardcoded array, roles now fetched from database

#### 2. Added Role State and Type

```typescript
type Role = {
  id: string;
  name: string;
  description?: string;
  is_system: boolean;
  org_id?: string | null;
};

const [roles, setRoles] = useState<Role[]>([]);
```

#### 3. Fetch Roles from API

Updated the `useEffect` to fetch roles from `/api/admin/permission-profiles`:

```typescript
const [u, o, r] = await Promise.all([
  fetch('/api/admin/users').then((r) => r.json()),
  fetch('/api/admin/orgs').then((r) => r.json()),
  fetch('/api/admin/permission-profiles').then((r) => r.json()), // NEW
]);

setRoles(
  (r.profiles || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    is_system: p.is_system,
    org_id: p.org_id,
  })),
);
```

#### 4. Dynamic Role Dropdown

Updated the role select to use fetched roles:

```typescript
<SelectContent>
  {roles.length === 0 ? (
    <SelectItem value="loading" disabled>Loading roles...</SelectItem>
  ) : (
    roles.map(r => (
      <SelectItem key={r.id} value={r.name}>
        {r.name}
        {r.description && <span className="text-xs text-muted-foreground"> - {r.description}</span>}
      </SelectItem>
    ))
  )}
</SelectContent>
```

#### 5. Show Role Description

Added helper text showing the selected role's description:

```typescript
{selectedRole && roles.find(r => r.name === selectedRole)?.description && (
  <p className="text-xs text-muted-foreground mt-1">
    {roles.find(r => r.name === selectedRole)?.description}
  </p>
)}
```

#### 6. Smart Default Role Selection

Added logic to select a sensible default role when roles load:

```typescript
useEffect(() => {
  if (roles.length > 0 && !selectedRole) {
    // Default to first non-portal role, or first role if none found
    const defaultRole = roles.find((r) => !r.name.toLowerCase().includes('portal')) || roles[0];
    setSelectedRole(defaultRole.name);
  }
}, [roles, selectedRole]);
```

---

## 🎯 Benefits

### Before (Hardcoded)

- ❌ Showed 7 hardcoded roles
- ❌ Roles might not exist in database
- ❌ Couldn't add new roles without code changes
- ❌ No role descriptions shown
- ❌ No validation that role exists

### After (Dynamic)

- ✅ Shows actual roles from `roles` table (currently 6 system roles)
- ✅ Automatically updates when roles are added/removed
- ✅ Shows role descriptions to help users choose
- ✅ Validates that selected role exists in database
- ✅ Smart default selection (prefers non-portal roles)

---

## 📊 Current Roles in Database

Based on the access report, these roles are now available in the dropdown:

1. **Developer** - Full access to all actions
2. **Owner Portal** - Owner portal default
3. **Staff - Manager** - Full staff access (manager)
4. **Staff - Standard** - Read/edit without approvals
5. **Tenant Portal** - Tenant portal default
6. **Vendor Portal** - Vendor portal default

---

## 🧪 Testing

### To Test the Changes:

1. **Navigate to**: `http://localhost:3000/settings/memberships`

2. **Verify**:
   - Role dropdown shows 6 roles (not 7 hardcoded ones)
   - Role descriptions appear below dropdown when selected
   - Default role is "Developer" or "Staff - Manager" (first non-portal role)

3. **Assign a role to brandon@managedbyora.com**:
   - User: `brandon@managedbyora.com`
   - Organization: `Ora Property Management`
   - Role: `Developer` (for full access)
   - Click "Assign Membership"

4. **Verify in database**:
   ```sql
   SELECT mr.*, r.name as role_name
   FROM public.membership_roles mr
   JOIN public.roles r ON r.id = mr.role_id
   WHERE mr.user_id = 'e4800813-a9ee-494a-a6a3-7f2d3cae6257';
   ```

---

## 🔄 API Flow

### When Assigning a Membership:

1. **UI**: User selects role name (e.g., "Developer")
2. **API**: `POST /api/admin/memberships/simple` with `{ role: "Developer" }`
3. **Backend**:
   - Creates/updates `org_memberships` record
   - Looks up role by name: `SELECT id FROM roles WHERE name = 'Developer'`
   - Creates `membership_roles` record with the role_id
4. **Result**: User now has both org membership AND role assignment

---

## 🚀 Next Steps

### Completed ✅

- [x] Fetch roles dynamically from database
- [x] Show role descriptions in UI
- [x] Smart default role selection
- [x] Validate roles exist in database

### Still Needed ❌

- [ ] Build role management UI (`/settings/roles`)
- [ ] Build permission management UI (`/settings/permissions`)
- [ ] Build role-permission mapping UI (`/settings/roles/[id]/permissions`)
- [ ] Connect organization settings to database
- [ ] Add ability to assign multiple roles to one user
- [ ] Show actual permissions for each role in memberships page

---

## 📝 Notes

- The API endpoint `/api/admin/permission-profiles` returns roles from the `roles` table
- The endpoint works with the new RBAC schema (post-migration)
- Role names must match exactly between UI and database
- System roles (is_system = true) are available to all organizations
- Org-specific roles (org_id not null) are only available to that org

---

## 🎉 Impact

**brandon@managedbyora.com can now**:

1. See all 6 actual roles from the database
2. Assign any of those roles to users
3. See role descriptions to make informed choices
4. Have their role assignment properly recorded in `membership_roles` table

**The RBAC system is now connected to the UI!**
