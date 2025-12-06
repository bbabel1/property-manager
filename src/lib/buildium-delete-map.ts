/**
 * Canonical delete EventNames from Buildium webhooks. Keep this list in sync with
 * the router handling and add new names here instead of ad-hoc string includes.
 */
export const DELETE_EVENT_NAMES = [
  // Lease transactions
  'LeaseTransactionDeleted',
  'LeaseTransaction.Deleted',
  // Leases
  'LeaseDeleted',
  'Lease.Deleted',
  // Lease tenants / move-outs
  'LeaseTenantDeleted',
  'LeaseTenant.Deleted',
  'LeaseTenantMoveOut',
  'MoveOutDeleted',
  'MoveOut.Deleted',
  // Bills & payments
  'BillDeleted',
  'Bill.Deleted',
  'Bill.PaymentDeleted',
  'BillPaymentDeleted',
  'Bill.Payment.Deleted',
  // GL accounts
  'GLAccountDeleted',
  'GLAccount.Deleted',
  // Rentals / units
  'RentalDeleted',
  'Rental.Deleted',
  'RentalPropertyDeleted',
  'RentalProperty.Deleted',
  'RentalUnitDeleted',
  'RentalUnit.Deleted',
  // Tasks
  'TaskDeleted',
  'Task.Deleted',
  // Task categories
  'TaskCategoryDeleted',
  'TaskCategory.Deleted',
  // Vendors / categories
  'VendorDeleted',
  'Vendor.Deleted',
  'VendorCategoryDeleted',
  'VendorCategory.Deleted',
  // Work orders
  'WorkOrderDeleted',
  'WorkOrder.Deleted',
  // Bank accounts
  'BankAccountDeleted',
  'BankAccount.Deleted',
] as const

const DELETE_EVENT_NAME_SET = new Set((DELETE_EVENT_NAMES as readonly string[]).map((n) => n.toLowerCase()))

export function isDeleteEventName(name?: string | null): boolean {
  if (!name || typeof name !== 'string') return false
  return DELETE_EVENT_NAME_SET.has(name.toLowerCase())
}

export function looksLikeDelete(event: any): boolean {
  const candidates = [
    typeof event?.EventType === 'string' ? event.EventType : null,
    typeof event?.EventName === 'string' ? event.EventName : null,
    typeof (event as any)?.type === 'string' ? (event as any).type : null,
  ].filter(Boolean) as string[]
  return candidates.some((c) => isDeleteEventName(c) || c.toLowerCase().includes('deleted'))
}
