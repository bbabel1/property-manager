import type { AppRole } from './auth/roles';

export type Permission =
  | 'properties.read'
  | 'properties.write'
  | 'owners.read'
  | 'owners.write'
  | 'leases.read'
  | 'leases.write'
  | 'monthly_logs.read'
  | 'monthly_logs.write'
  | 'monthly_logs.approve'
  | 'monthly_logs.send_statement';

const Matrix: Record<AppRole, Permission[]> = {
  platform_admin: [
    'properties.read',
    'properties.write',
    'owners.read',
    'owners.write',
    'leases.read',
    'leases.write',
    'monthly_logs.read',
    'monthly_logs.write',
    'monthly_logs.approve',
    'monthly_logs.send_statement',
  ],
  org_admin: [
    'properties.read',
    'properties.write',
    'owners.read',
    'owners.write',
    'leases.read',
    'leases.write',
    'monthly_logs.read',
    'monthly_logs.write',
    'monthly_logs.approve',
    'monthly_logs.send_statement',
  ],
  org_manager: [
    'properties.read',
    'properties.write',
    'owners.read',
    'owners.write',
    'leases.read',
    'leases.write',
    'monthly_logs.read',
    'monthly_logs.write',
    'monthly_logs.approve',
    'monthly_logs.send_statement',
  ],
  org_staff: [
    'properties.read',
    'owners.read',
    'leases.read',
    'monthly_logs.read',
    'monthly_logs.write', // Staff can edit but not approve or send
  ],
  owner_portal: [
    'properties.read',
    'leases.read',
    'monthly_logs.read', // Owners can view their own statements
  ],
  tenant_portal: ['leases.read'], // No monthly log access for tenants
};

export function hasPermission(roles: AppRole[], perm: Permission) {
  return roles.some((r) => Matrix[r]?.includes(perm));
}
