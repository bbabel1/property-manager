import { canonicalizeEventName } from '../../supabase/functions/_shared/eventValidation'

/**
 * Canonical delete EventNames from Buildium webhooks. Keep this list in sync with
 * the router handling and add new names here instead of ad-hoc string includes.
 */
export const DELETE_EVENT_NAMES = [
  // Lease transactions
  'LeaseTransaction.Deleted',
  // Leases
  'Lease.Deleted',
  // Lease tenants / move-outs
  'LeaseTenant.Deleted',
  'Lease.MoveOut.Deleted',
  // Bills & payments
  'Bill.Deleted',
  'Bill.Payment.Deleted',
  // GL accounts
  'GLAccount.Deleted',
  // Rentals / units
  'Rental.Deleted',
  'RentalUnit.Deleted',
  'RentalOwner.Deleted',
  // Tasks & history
  'Task.Deleted',
  'Task.History.Deleted',
  // Task categories
  'TaskCategory.Deleted',
  // Vendors / categories / transactions
  'Vendor.Deleted',
  'VendorCategory.Deleted',
  'Vendor.Transaction.Deleted',
  // Work orders
  'WorkOrder.Deleted',
  // Bank accounts
  'BankAccount.Deleted',
  // Owners / properties
  'Owner.Deleted',
  'Property.Deleted',
] as const

const DELETE_EVENT_NAME_SET = new Set((DELETE_EVENT_NAMES as readonly string[]).map((n) => n.toLowerCase()))

export function isDeleteEventName(name?: string | null): boolean {
  if (!name || typeof name !== 'string') return false
  const canonical = canonicalizeEventName(name)
  return DELETE_EVENT_NAME_SET.has(canonical.toLowerCase())
}

export function looksLikeDelete(event: unknown): boolean {
  const record = event && typeof event === 'object' ? (event as Record<string, unknown>) : null
  const candidates = [
    typeof record?.EventType === 'string' ? record.EventType : null,
    typeof record?.EventName === 'string' ? record.EventName : null,
    typeof record?.type === 'string' ? record.type : null,
  ].filter(Boolean) as string[]
  return candidates.some((c) => isDeleteEventName(c) || canonicalizeEventName(c).toLowerCase().includes('deleted'))
}
