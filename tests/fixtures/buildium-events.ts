import type { BuildiumWebhookEventLike } from '../../supabase/functions/_shared/eventValidation';

type Fixture = { name: string; event: BuildiumWebhookEventLike; valid?: boolean };

export const buildiumEventFixtures: Fixture[] = [
  // General / properties / owners / leases
  {
    name: 'Property.Created',
    event: {
      Id: 'evt-property-1',
      EventType: 'Property.Created',
      EventDate: '2024-01-01',
      EntityId: 11,
    },
  },
  {
    name: 'Property.Updated',
    event: {
      Id: 'evt-property-2',
      EventType: 'Property.Updated',
      EventDate: '2024-01-02',
      EntityId: 11,
    },
  },
  {
    name: 'Owner.Created',
    event: {
      Id: 'evt-owner-core',
      EventType: 'Owner.Created',
      EventDate: '2024-01-02',
      EntityId: 22,
    },
  },
  {
    name: 'Owner.Updated',
    event: {
      Id: 'evt-owner-upd',
      EventType: 'Owner.Updated',
      EventDate: '2024-01-03',
      EntityId: 22,
    },
  },

  {
    name: 'Rental.Created',
    event: {
      Id: 'evt-rental-1',
      EventType: 'Rental.Created',
      EventDate: '2024-01-01',
      PropertyId: 101,
      EntityId: 101,
    },
  },
  {
    name: 'Rental.Updated',
    event: {
      Id: 'evt-rental-2',
      EventType: 'Rental.Updated',
      EventDate: '2024-01-02',
      PropertyId: 101,
      EntityId: 101,
    },
  },
  {
    name: 'Rental.Deleted',
    event: {
      Id: 'evt-rental-del',
      EventType: 'Rental.Deleted',
      EventDate: '2024-01-03',
      PropertyId: 101,
      EntityId: 101,
    },
  },

  {
    name: 'RentalUnit.Created',
    event: {
      Id: 'evt-unit-1',
      EventType: 'RentalUnit.Created',
      EventDate: '2024-01-01',
      UnitId: 201,
      PropertyId: 101,
    },
  },
  {
    name: 'RentalUnit.Updated',
    event: {
      Id: 'evt-unit-2',
      EventType: 'RentalUnit.Updated',
      EventDate: '2024-01-02',
      UnitId: 201,
      PropertyId: 101,
    },
  },
  {
    name: 'RentalUnit.Deleted',
    event: {
      Id: 'evt-unit-del',
      EventType: 'RentalUnit.Deleted',
      EventDate: '2024-01-03',
      UnitId: 201,
      PropertyId: 101,
    },
  },

  {
    name: 'Lease.Created',
    event: {
      Id: 'evt-lease-1',
      EventType: 'Lease.Created',
      EventDate: '2024-01-01',
      LeaseId: 301,
      EntityId: 301,
      PropertyId: 101,
    },
  },
  {
    name: 'Lease.Updated',
    event: {
      Id: 'evt-lease-2',
      EventType: 'Lease.Updated',
      EventDate: '2024-01-02',
      LeaseId: 301,
      EntityId: 301,
    },
  },
  {
    name: 'Lease.Deleted',
    event: {
      Id: 'evt-lease-del',
      EventType: 'Lease.Deleted',
      EventDate: '2024-01-03',
      LeaseId: 301,
      EntityId: 301,
    },
  },

  // Lease transactions / tenants / move-outs
  {
    name: 'LeaseTransaction.Created',
    event: {
      Id: 'evt-leasetrx-1',
      EventType: 'LeaseTransaction.Created',
      EventDate: '2024-01-01',
      LeaseId: 301,
      TransactionId: 401,
    },
  },
  {
    name: 'LeaseTransaction.Updated',
    event: {
      Id: 'evt-leasetrx-2',
      EventType: 'LeaseTransaction.Updated',
      EventDate: '2024-01-02',
      LeaseId: 301,
      TransactionId: 401,
    },
  },
  {
    name: 'LeaseTransaction.Deleted',
    event: {
      Id: 'evt-leasetrx-del',
      EventType: 'LeaseTransaction.Deleted',
      EventDate: '2024-01-02',
      LeaseId: 301,
      TransactionId: 401,
    },
  },

  {
    name: 'LeaseTenant.Created',
    event: {
      Id: 'evt-tenant-1',
      EventType: 'LeaseTenant.Created',
      EventDate: '2024-02-01',
      LeaseId: 301,
      TenantId: 501,
      EntityId: 501,
    },
  },
  {
    name: 'LeaseTenant.Updated',
    event: {
      Id: 'evt-tenant-2',
      EventType: 'LeaseTenant.Updated',
      EventDate: '2024-02-02',
      LeaseId: 301,
      TenantId: 501,
      EntityId: 501,
    },
  },
  {
    name: 'LeaseTenant.Deleted',
    event: {
      Id: 'evt-tenant-del',
      EventType: 'LeaseTenant.Deleted',
      EventDate: '2024-02-03',
      TenantId: 501,
      EntityId: 501,
    },
  },

  {
    name: 'Lease.MoveOut.Created',
    event: {
      Id: 'evt-moveout-1',
      EventType: 'Lease.MoveOut.Created',
      EventDate: '2024-02-04',
      LeaseId: 301,
      TenantId: 501,
      EntityId: 501,
    },
  },
  {
    name: 'Lease.MoveOut.Updated',
    event: {
      Id: 'evt-moveout-2',
      EventType: 'Lease.MoveOut.Updated',
      EventDate: '2024-02-05',
      LeaseId: 301,
      TenantId: 501,
      EntityId: 501,
    },
  },
  {
    name: 'Lease.MoveOut.Deleted',
    event: {
      Id: 'evt-moveout-3',
      EventType: 'Lease.MoveOut.Deleted',
      EventDate: '2024-02-06',
      LeaseId: 301,
      TenantId: 501,
      EntityId: 501,
    },
  },

  // Bills & payments
  {
    name: 'Bill.Created',
    event: {
      Id: 'evt-bill-1',
      EventType: 'Bill.Created',
      EventDate: '2024-01-03',
      BillId: 601,
      EntityId: 601,
    },
  },
  {
    name: 'Bill.Updated',
    event: {
      Id: 'evt-bill-2',
      EventType: 'Bill.Updated',
      EventDate: '2024-01-04',
      BillId: 601,
      EntityId: 601,
    },
  },
  {
    name: 'Bill.Deleted',
    event: {
      Id: 'evt-bill-del',
      EventType: 'Bill.Deleted',
      EventDate: '2024-01-04',
      BillId: 601,
      EntityId: 601,
    },
  },

  {
    name: 'Bill.Payment.Created',
    event: {
      Id: 'evt-pay-1',
      EventType: 'Bill.Payment.Created',
      EventDate: '2024-01-05',
      PaymentId: 701,
      BillIds: [601],
    },
  },
  {
    name: 'Bill.Payment.Updated',
    event: {
      Id: 'evt-pay-2',
      EventType: 'Bill.Payment.Updated',
      EventDate: '2024-01-06',
      PaymentId: 701,
      BillIds: [601],
    },
  },
  {
    name: 'Bill.Payment.Deleted',
    event: {
      Id: 'evt-pay-del',
      EventType: 'Bill.Payment.Deleted',
      EventDate: '2024-01-06',
      PaymentId: 701,
      BillIds: [601],
    },
  },

  // GL accounts
  {
    name: 'GLAccount.Created',
    event: {
      Id: 'evt-gl-1',
      EventType: 'GLAccount.Created',
      EventDate: '2024-01-07',
      GLAccountId: 801,
      EntityId: 801,
    },
  },
  {
    name: 'GLAccount.Updated',
    event: {
      Id: 'evt-gl-2',
      EventType: 'GLAccount.Updated',
      EventDate: '2024-01-07',
      GLAccountId: 801,
      EntityId: 801,
    },
  },
  {
    name: 'GLAccount.Deleted',
    event: {
      Id: 'evt-gl-del',
      EventType: 'GLAccount.Deleted',
      EventDate: '2024-01-07',
      GLAccountId: 801,
      EntityId: 801,
    },
  },

  // Tasks, history, categories
  {
    name: 'Task.Created',
    event: {
      Id: 'evt-task-1',
      EventType: 'Task.Created',
      EventDate: '2024-01-08',
      TaskId: 901,
      EntityId: 901,
    },
  },
  {
    name: 'Task.Updated',
    event: {
      Id: 'evt-task-2',
      EventType: 'Task.Updated',
      EventDate: '2024-01-08',
      TaskId: 901,
      EntityId: 901,
    },
  },
  {
    name: 'Task.Deleted',
    event: {
      Id: 'evt-task-del',
      EventType: 'Task.Deleted',
      EventDate: '2024-01-08',
      TaskId: 901,
      EntityId: 901,
    },
  },

  {
    name: 'Task.History.Created',
    event: {
      Id: 'evt-taskhist-1',
      EventType: 'Task.History.Created',
      EventDate: '2024-01-09',
      TaskId: 901,
      EntityId: 901,
    },
  },
  {
    name: 'Task.History.Updated',
    event: {
      Id: 'evt-taskhist-2',
      EventType: 'Task.History.Updated',
      EventDate: '2024-01-10',
      TaskId: 901,
      EntityId: 901,
    },
  },
  {
    name: 'Task.History.Deleted',
    event: {
      Id: 'evt-taskhist-3',
      EventType: 'Task.History.Deleted',
      EventDate: '2024-01-11',
      TaskId: 901,
      EntityId: 901,
    },
  },

  {
    name: 'TaskCategory.Created',
    event: {
      Id: 'evt-tc-1',
      EventType: 'TaskCategory.Created',
      EventDate: '2024-01-08',
      TaskCategoryId: 902,
      EntityId: 902,
    },
  },
  {
    name: 'TaskCategory.Updated',
    event: {
      Id: 'evt-tc-2',
      EventType: 'TaskCategory.Updated',
      EventDate: '2024-01-08',
      TaskCategoryId: 902,
      EntityId: 902,
    },
  },
  {
    name: 'TaskCategory.Deleted',
    event: {
      Id: 'evt-tc-del',
      EventType: 'TaskCategory.Deleted',
      EventDate: '2024-01-08',
      TaskCategoryId: 902,
      EntityId: 902,
    },
  },

  // Vendors & categories & transactions
  {
    name: 'VendorCategory.Created',
    event: {
      Id: 'evt-vc-1',
      EventType: 'VendorCategory.Created',
      EventDate: '2024-01-09',
      VendorCategoryId: 1001,
      EntityId: 1001,
    },
  },
  {
    name: 'VendorCategory.Updated',
    event: {
      Id: 'evt-vc-2',
      EventType: 'VendorCategory.Updated',
      EventDate: '2024-01-09',
      VendorCategoryId: 1001,
      EntityId: 1001,
    },
  },
  {
    name: 'VendorCategory.Deleted',
    event: {
      Id: 'evt-vcat-del',
      EventType: 'VendorCategory.Deleted',
      EventDate: '2024-01-09',
      VendorCategoryId: 1001,
      EntityId: 1001,
    },
  },

  {
    name: 'Vendor.Created',
    event: {
      Id: 'evt-vendor-1',
      EventType: 'Vendor.Created',
      EventDate: '2024-01-10',
      VendorId: 1101,
      EntityId: 1101,
    },
  },
  {
    name: 'Vendor.Updated',
    event: {
      Id: 'evt-vendor-2',
      EventType: 'Vendor.Updated',
      EventDate: '2024-01-10',
      VendorId: 1101,
      EntityId: 1101,
    },
  },
  {
    name: 'Vendor.Deleted',
    event: {
      Id: 'evt-vendor-del',
      EventType: 'Vendor.Deleted',
      EventDate: '2024-01-10',
      VendorId: 1101,
      EntityId: 1101,
    },
  },

  {
    name: 'Vendor.Transaction.Created',
    event: {
      Id: 'evt-vendor-tx-1',
      EventType: 'Vendor.Transaction.Created',
      EventDate: '2024-01-12',
      VendorId: 1101,
      EntityId: 1101,
    },
  },
  {
    name: 'Vendor.Transaction.Updated',
    event: {
      Id: 'evt-vendor-tx-2',
      EventType: 'Vendor.Transaction.Updated',
      EventDate: '2024-01-13',
      VendorId: 1101,
      EntityId: 1101,
    },
  },
  {
    name: 'Vendor.Transaction.Deleted',
    event: {
      Id: 'evt-vendor-tx-3',
      EventType: 'Vendor.Transaction.Deleted',
      EventDate: '2024-01-14',
      VendorId: 1101,
      EntityId: 1101,
    },
  },

  // Work orders
  {
    name: 'WorkOrder.Created',
    event: {
      Id: 'evt-wo-1',
      EventType: 'WorkOrder.Created',
      EventDate: '2024-01-11',
      WorkOrderId: 1201,
      EntityId: 1201,
    },
  },
  {
    name: 'WorkOrder.Updated',
    event: {
      Id: 'evt-wo-2',
      EventType: 'WorkOrder.Updated',
      EventDate: '2024-01-11',
      WorkOrderId: 1201,
      EntityId: 1201,
    },
  },
  {
    name: 'WorkOrder.Deleted',
    event: {
      Id: 'evt-wo-del',
      EventType: 'WorkOrder.Deleted',
      EventDate: '2024-01-11',
      WorkOrderId: 1201,
      EntityId: 1201,
    },
  },

  // Rental owners
  {
    name: 'RentalOwner.Created',
    event: {
      Id: 'evt-owner-1',
      EventType: 'RentalOwner.Created',
      EventDate: '2024-01-12',
      RentalOwnerId: 1301,
      EntityId: 1301,
      AccountId: 1,
    },
  },
  {
    name: 'RentalOwner.Updated',
    event: {
      Id: 'evt-owner-2',
      EventType: 'RentalOwner.Updated',
      EventDate: '2024-01-12',
      RentalOwnerId: 1301,
      EntityId: 1301,
      AccountId: 1,
    },
  },
  {
    name: 'RentalOwner.Deleted',
    event: {
      Id: 'evt-owner-del',
      EventType: 'RentalOwner.Deleted',
      EventDate: '2024-01-12',
      RentalOwnerId: 1301,
      EntityId: 1301,
    },
  },

  // Bank accounts
  {
    name: 'BankAccount.Created',
    event: {
      Id: 'evt-bank-1',
      EventType: 'BankAccount.Created',
      EventDate: '2024-01-13',
      BankAccountId: 1401,
      EntityId: 1401,
    },
  },
  {
    name: 'BankAccount.Updated',
    event: {
      Id: 'evt-bank-2',
      EventType: 'BankAccount.Updated',
      EventDate: '2024-01-13',
      BankAccountId: 1401,
      EntityId: 1401,
    },
  },
  {
    name: 'BankAccount.Deleted',
    event: {
      Id: 'evt-bank-del',
      EventType: 'BankAccount.Deleted',
      EventDate: '2024-01-13',
      BankAccountId: 1401,
      EntityId: 1401,
    },
  },

  // Legacy alias (camelCase) to ensure normalization still passes
  {
    name: 'Alias LeaseTransactionCreated',
    event: {
      Id: 'evt-alias-lease-tx',
      EventType: 'LeaseTransactionCreated',
      EventDate: '2024-04-01',
      LeaseId: 999,
      TransactionId: 888,
    },
  },

  // Malformed
  {
    name: 'Malformed missing ids',
    event: { EventType: 'Bill.Payment.Created', EventDate: '2024-01-05' },
    valid: false,
  },
  {
    name: 'Malformed missing date',
    event: { Id: 'evt-bad-date', EventType: 'Lease.Created', LeaseId: 777, EntityId: 777 },
    valid: false,
  },
];
