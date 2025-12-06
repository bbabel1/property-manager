import type { Database } from '@/types/database'

export type StaffRole = Database['public']['Enums']['staff_roles']

// Normalized aliases for staff roles coming from various UI/back-end sources
const STAFF_ROLE_ALIASES: Record<string, StaffRole> = {
  'property manager': 'Property Manager',
  'property_manager': 'Property Manager',
  'propertymanager': 'Property Manager',
  'propertymanagerassistant': 'Assistant Property Manager',
  'assistant_property_manager': 'Assistant Property Manager',
  'assistantpropertymanager': 'Assistant Property Manager',
  'assistant property manager': 'Assistant Property Manager',
  'org_manager': 'Property Manager',
  'bookkeeper': 'Bookkeeper',
  'buildium_bookkeeper': 'Bookkeeper',
  'finance_manager': 'Bookkeeper',
  'maintenance_coordinator': 'Maintenance Coordinator',
  'maintenance': 'Maintenance Coordinator',
  'maintenancecoord': 'Maintenance Coordinator',
  'accountant': 'Accountant',
  'finance': 'Accountant',
  'administrator': 'Administrator',
  'admin': 'Administrator',
}

/**
 * Attempts to coerce a provided role string into the canonical staff role enum value.
 * Returns `null` when the input cannot be mapped confidently.
 */
export function normalizeStaffRole(input: unknown): StaffRole | null {
  if (typeof input !== 'string') return null
  const key = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return STAFF_ROLE_ALIASES[key] ?? null
}

export function assertStaffRole(role: StaffRole | null, context: string): StaffRole {
  if (!role) {
    throw new Error(`Invalid staff role provided${context ? ` for ${context}` : ''}`)
  }
  return role
}

export function isStaffRole(input: unknown): input is StaffRole {
  return normalizeStaffRole(input) !== null
}
