import { describe, expect, it } from 'vitest';

import { AllPermissions, hasPermission, permissionsForRoles } from '@/lib/permissions';

describe('bill overlay permissions', () => {
  it('includes bill permissions in AllPermissions', () => {
    expect(AllPermissions).toEqual(expect.arrayContaining(['bills.read', 'bills.write', 'bills.approve', 'bills.void']));
  });

  it('grants admins full bill permissions', () => {
    const perms = permissionsForRoles(['org_admin']);
    expect(perms).toEqual(expect.arrayContaining(['bills.read', 'bills.write', 'bills.approve', 'bills.void']));
    expect(hasPermission(['org_admin'], 'bills.approve')).toBe(true);
    expect(hasPermission(['org_admin'], 'bills.void')).toBe(true);
  });

  it('grants staff read/write but not approve/void', () => {
    expect(hasPermission(['org_staff'], 'bills.read')).toBe(true);
    expect(hasPermission(['org_staff'], 'bills.write')).toBe(true);
    expect(hasPermission(['org_staff'], 'bills.approve')).toBe(false);
    expect(hasPermission(['org_staff'], 'bills.void')).toBe(false);
  });

  it('denies bill permissions to non-staff/owner/tenant roles', () => {
    expect(hasPermission(['owner_portal'], 'bills.read')).toBe(false);
    expect(hasPermission(['tenant_portal'], 'bills.read')).toBe(false);
    expect(hasPermission(['vendor_portal'], 'bills.write')).toBe(false);
  });
});
