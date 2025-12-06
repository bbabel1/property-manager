import type { BuildiumWebhookEventLike } from '../../supabase/functions/_shared/eventValidation'

type Fixture = { name: string; event: BuildiumWebhookEventLike; valid?: boolean }

export const buildiumEventFixtures: Fixture[] = [
  { name: 'PropertyCreated', event: { Id: 'evt-property-1', EventType: 'PropertyCreated', EventDate: '2024-01-01', EntityId: 11 } },
  { name: 'PropertyUpdated', event: { Id: 'evt-property-2', EventType: 'PropertyUpdated', EventDate: '2024-01-02', EntityId: 11 } },
  { name: 'OwnerCreated', event: { Id: 'evt-owner-core', EventType: 'OwnerCreated', EventDate: '2024-01-02', EntityId: 22 } },
  { name: 'OwnerUpdated', event: { Id: 'evt-owner-upd', EventType: 'OwnerUpdated', EventDate: '2024-01-03', EntityId: 22 } },

  { name: 'RentalCreated', event: { Id: 'evt-rental-1', EventType: 'RentalCreated', EventDate: '2024-01-01', PropertyId: 101, EntityId: 101 } },
  { name: 'RentalUpdated', event: { Id: 'evt-rental-2', EventType: 'RentalUpdated', EventDate: '2024-01-02', PropertyId: 101, EntityId: 101 } },
  { name: 'RentalDeleted', event: { Id: 'evt-rental-del', EventType: 'RentalDeleted', EventDate: '2024-01-03', PropertyId: 101, EntityId: 101 } },
  { name: 'Rental.Deleted', event: { Id: 'evt-rental-del-dot', EventType: 'Rental.Deleted', EventDate: '2024-01-03', PropertyId: 101, EntityId: 101 } },

  { name: 'RentalUnitCreated', event: { Id: 'evt-unit-1', EventType: 'RentalUnitCreated', EventDate: '2024-01-01', UnitId: 201, PropertyId: 101 } },
  { name: 'RentalUnitUpdated', event: { Id: 'evt-unit-2', EventType: 'RentalUnitUpdated', EventDate: '2024-01-02', UnitId: 201, PropertyId: 101 } },
  { name: 'RentalUnitDeleted', event: { Id: 'evt-unit-del', EventType: 'RentalUnitDeleted', EventDate: '2024-01-03', UnitId: 201, PropertyId: 101 } },
  { name: 'RentalUnit.Deleted', event: { Id: 'evt-unit-del-dot', EventType: 'RentalUnit.Deleted', EventDate: '2024-01-03', UnitId: 201, PropertyId: 101 } },

  { name: 'LeaseCreated', event: { Id: 'evt-lease-1', EventType: 'LeaseCreated', EventDate: '2024-01-01', LeaseId: 301, EntityId: 301, PropertyId: 101 } },
  { name: 'LeaseUpdated', event: { Id: 'evt-lease-2', EventType: 'LeaseUpdated', EventDate: '2024-01-02', LeaseId: 301, EntityId: 301 } },
  { name: 'LeaseDeleted', event: { Id: 'evt-lease-del', EventType: 'LeaseDeleted', EventDate: '2024-01-03', LeaseId: 301, EntityId: 301 } },
  { name: 'Lease.Deleted', event: { Id: 'evt-lease-del-dot', EventType: 'Lease.Deleted', EventDate: '2024-01-03', LeaseId: 301, EntityId: 301 } },

  { name: 'LeaseTransactionCreated', event: { Id: 'evt-leasetrx-1', EventType: 'LeaseTransactionCreated', EventDate: '2024-01-01', LeaseId: 301, TransactionId: 401 } },
  { name: 'LeaseTransactionUpdated', event: { Id: 'evt-leasetrx-2', EventType: 'LeaseTransactionUpdated', EventDate: '2024-01-02', LeaseId: 301, TransactionId: 401 } },
  { name: 'LeaseTransactionDeleted', event: { Id: 'evt-leasetrx-del', EventType: 'LeaseTransactionDeleted', EventDate: '2024-01-02', LeaseId: 301, TransactionId: 401 } },
  { name: 'LeaseTransaction.Deleted', event: { Id: 'evt-leasetrx-del-dot', EventType: 'LeaseTransaction.Deleted', EventDate: '2024-01-02', LeaseId: 301, TransactionId: 401 } },

  { name: 'LeaseTenantMoveOut', event: { Id: 'evt-moveout-1', EventType: 'LeaseTenantMoveOut', EventDate: '2024-02-01', LeaseId: 301, TenantId: 501, EntityId: 501 } },
  { name: 'LeaseTenantDeleted', event: { Id: 'evt-tenant-del', EventType: 'LeaseTenantDeleted', EventDate: '2024-02-02', TenantId: 501, EntityId: 501 } },
  { name: 'MoveOutDeleted', event: { Id: 'evt-moveout-del', EventType: 'MoveOutDeleted', EventDate: '2024-02-03', LeaseId: 301, TenantId: 501, EntityId: 501 } },
  { name: 'MoveOut.Deleted', event: { Id: 'evt-moveout-del-dot', EventType: 'MoveOut.Deleted', EventDate: '2024-02-03', LeaseId: 301, TenantId: 501, EntityId: 501 } },

  { name: 'BillCreated', event: { Id: 'evt-bill-1', EventType: 'BillCreated', EventDate: '2024-01-03', BillId: 601, EntityId: 601 } },
  { name: 'BillUpdated', event: { Id: 'evt-bill-2', EventType: 'BillUpdated', EventDate: '2024-01-04', BillId: 601, EntityId: 601 } },
  { name: 'BillDeleted', event: { Id: 'evt-bill-del', EventType: 'BillDeleted', EventDate: '2024-01-04', BillId: 601, EntityId: 601 } },
  { name: 'Bill.Deleted', event: { Id: 'evt-bill-del-dot', EventType: 'Bill.Deleted', EventDate: '2024-01-04', BillId: 601, EntityId: 601 } },

  { name: 'Bill.PaymentUpdated', event: { Id: 'evt-pay-1', EventType: 'Bill.PaymentUpdated', EventDate: '2024-01-05', PaymentId: 701, BillIds: [601] } },
  { name: 'Bill.PaymentDeleted', event: { Id: 'evt-pay-del', EventType: 'Bill.PaymentDeleted', EventDate: '2024-01-06', PaymentId: 701, BillIds: [601] } },
  { name: 'BillPaymentDeleted', event: { Id: 'evt-pay-del2', EventType: 'BillPaymentDeleted', EventDate: '2024-01-06', PaymentId: 701, BillIds: [601] } },

  { name: 'GLAccountCreated', event: { Id: 'evt-gl-1', EventType: 'GLAccountCreated', EventDate: '2024-01-07', GLAccountId: 801, EntityId: 801 } },
  { name: 'GLAccountUpdated', event: { Id: 'evt-gl-2', EventType: 'GLAccountUpdated', EventDate: '2024-01-07', GLAccountId: 801, EntityId: 801 } },
  { name: 'GLAccountDeleted', event: { Id: 'evt-gl-del', EventType: 'GLAccountDeleted', EventDate: '2024-01-07', GLAccountId: 801, EntityId: 801 } },
  { name: 'GLAccount.Deleted', event: { Id: 'evt-gl-del-dot', EventType: 'GLAccount.Deleted', EventDate: '2024-01-07', GLAccountId: 801, EntityId: 801 } },

  { name: 'TaskCreated', event: { Id: 'evt-task-1', EventType: 'TaskCreated', EventDate: '2024-01-08', TaskId: 901, EntityId: 901 } },
  { name: 'TaskUpdated', event: { Id: 'evt-task-2', EventType: 'TaskUpdated', EventDate: '2024-01-08', TaskId: 901, EntityId: 901 } },
  { name: 'TaskDeleted', event: { Id: 'evt-task-del', EventType: 'TaskDeleted', EventDate: '2024-01-08', TaskId: 901, EntityId: 901 } },
  { name: 'Task.Deleted', event: { Id: 'evt-task-del-dot', EventType: 'Task.Deleted', EventDate: '2024-01-08', TaskId: 901, EntityId: 901 } },

  { name: 'TaskCategoryCreated', event: { Id: 'evt-tc-1', EventType: 'TaskCategoryCreated', EventDate: '2024-01-08', TaskCategoryId: 902, EntityId: 902 } },
  { name: 'TaskCategoryUpdated', event: { Id: 'evt-tc-2', EventType: 'TaskCategoryUpdated', EventDate: '2024-01-08', TaskCategoryId: 902, EntityId: 902 } },
  { name: 'TaskCategoryDeleted', event: { Id: 'evt-tc-del', EventType: 'TaskCategoryDeleted', EventDate: '2024-01-08', TaskCategoryId: 902, EntityId: 902 } },
  { name: 'TaskCategory.Deleted', event: { Id: 'evt-tc-del-dot', EventType: 'TaskCategory.Deleted', EventDate: '2024-01-08', TaskCategoryId: 902, EntityId: 902 } },

  { name: 'VendorCategoryCreated', event: { Id: 'evt-vc-1', EventType: 'VendorCategoryCreated', EventDate: '2024-01-09', VendorCategoryId: 1001, EntityId: 1001 } },
  { name: 'VendorCategoryUpdated', event: { Id: 'evt-vc-2', EventType: 'VendorCategoryUpdated', EventDate: '2024-01-09', VendorCategoryId: 1001, EntityId: 1001 } },
  { name: 'VendorCategoryDeleted', event: { Id: 'evt-vcat-del', EventType: 'VendorCategoryDeleted', EventDate: '2024-01-09', VendorCategoryId: 1001, EntityId: 1001 } },
  { name: 'VendorCategory.Deleted', event: { Id: 'evt-vcat-del-dot', EventType: 'VendorCategory.Deleted', EventDate: '2024-01-09', VendorCategoryId: 1001, EntityId: 1001 } },

  { name: 'VendorCreated', event: { Id: 'evt-vendor-1', EventType: 'VendorCreated', EventDate: '2024-01-10', VendorId: 1101, EntityId: 1101 } },
  { name: 'VendorUpdated', event: { Id: 'evt-vendor-2', EventType: 'VendorUpdated', EventDate: '2024-01-10', VendorId: 1101, EntityId: 1101 } },
  { name: 'VendorDeleted', event: { Id: 'evt-vendor-del', EventType: 'VendorDeleted', EventDate: '2024-01-10', VendorId: 1101, EntityId: 1101 } },
  { name: 'Vendor.Deleted', event: { Id: 'evt-vendor-del-dot', EventType: 'Vendor.Deleted', EventDate: '2024-01-10', VendorId: 1101, EntityId: 1101 } },

  { name: 'WorkOrderCreated', event: { Id: 'evt-wo-1', EventType: 'WorkOrderCreated', EventDate: '2024-01-11', WorkOrderId: 1201, EntityId: 1201 } },
  { name: 'WorkOrderUpdated', event: { Id: 'evt-wo-2', EventType: 'WorkOrderUpdated', EventDate: '2024-01-11', WorkOrderId: 1201, EntityId: 1201 } },
  { name: 'WorkOrderDeleted', event: { Id: 'evt-wo-del', EventType: 'WorkOrderDeleted', EventDate: '2024-01-11', WorkOrderId: 1201, EntityId: 1201 } },
  { name: 'WorkOrder.Deleted', event: { Id: 'evt-wo-del-dot', EventType: 'WorkOrder.Deleted', EventDate: '2024-01-11', WorkOrderId: 1201, EntityId: 1201 } },

  { name: 'RentalOwnerCreated', event: { Id: 'evt-owner-1', EventType: 'RentalOwnerCreated', EventDate: '2024-01-12', RentalOwnerId: 1301, EntityId: 1301, AccountId: 1 } },
  { name: 'RentalOwnerUpdated', event: { Id: 'evt-owner-2', EventType: 'RentalOwnerUpdated', EventDate: '2024-01-12', RentalOwnerId: 1301, EntityId: 1301, AccountId: 1 } },
  { name: 'RentalOwnerDeleted', event: { Id: 'evt-owner-del', EventType: 'RentalOwnerDeleted', EventDate: '2024-01-12', RentalOwnerId: 1301, EntityId: 1301 } },

  { name: 'BankAccountDeleted', event: { Id: 'evt-bank-del', EventType: 'BankAccountDeleted', EventDate: '2024-01-13', BankAccountId: 1401, EntityId: 1401 } },
  { name: 'BankAccount.Deleted', event: { Id: 'evt-bank-del-dot', EventType: 'BankAccount.Deleted', EventDate: '2024-01-13', BankAccountId: 1401, EntityId: 1401 } },

  // Malformed
  { name: 'Malformed missing ids', event: { EventType: 'Bill.PaymentUpdated', EventDate: '2024-01-05' }, valid: false },
  { name: 'Malformed missing date', event: { Id: 'evt-bad-date', EventType: 'LeaseCreated', LeaseId: 777, EntityId: 777 }, valid: false },
]
