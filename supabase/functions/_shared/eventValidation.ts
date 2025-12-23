// deno-lint-ignore-file
export const GENERAL_EVENT_NAMES = [
  'Property.Created',
  'Property.Updated',
  'Property.Deleted',
  'Owner.Created',
  'Owner.Updated',
  'Owner.Deleted',
] as const;

const LEASE_EVENT_NAMES = ['Lease.Created', 'Lease.Updated', 'Lease.Deleted'] as const;

export const LEASE_TRANSACTION_EVENT_NAMES = [
  'LeaseTransaction.Created',
  'LeaseTransaction.Updated',
  'LeaseTransaction.Deleted',
] as const;

const LEASE_TENANT_EVENT_NAMES = [
  'LeaseTenant.Created',
  'LeaseTenant.Updated',
  'LeaseTenant.Deleted',
] as const;

const MOVE_OUT_EVENT_NAMES = [
  'Lease.MoveOut.Created',
  'Lease.MoveOut.Updated',
  'Lease.MoveOut.Deleted',
] as const;

const BILL_PAYMENT_EVENT_NAMES = [
  'Bill.Payment.Created',
  'Bill.Payment.Updated',
  'Bill.Payment.Deleted',
] as const;

const BILL_EVENT_NAMES = ['Bill.Created', 'Bill.Updated', 'Bill.Deleted'] as const;

const GL_ACCOUNT_EVENT_NAMES = [
  'GLAccount.Created',
  'GLAccount.Updated',
  'GLAccount.Deleted',
] as const;

const RENTAL_OWNER_EVENT_NAMES = [
  'RentalOwner.Created',
  'RentalOwner.Updated',
  'RentalOwner.Deleted',
] as const;

const RENTAL_PROPERTY_EVENT_NAMES = ['Rental.Created', 'Rental.Updated', 'Rental.Deleted'] as const;

const RENTAL_UNIT_EVENT_NAMES = [
  'RentalUnit.Created',
  'RentalUnit.Updated',
  'RentalUnit.Deleted',
] as const;

const TASK_CATEGORY_EVENT_NAMES = [
  'TaskCategory.Created',
  'TaskCategory.Updated',
  'TaskCategory.Deleted',
] as const;

const TASK_HISTORY_EVENT_NAMES = [
  'Task.History.Created',
  'Task.History.Updated',
  'Task.History.Deleted',
] as const;

const TASK_EVENT_NAMES = ['Task.Created', 'Task.Updated', 'Task.Deleted'] as const;

const VENDOR_CATEGORY_EVENT_NAMES = [
  'VendorCategory.Created',
  'VendorCategory.Updated',
  'VendorCategory.Deleted',
] as const;

const VENDOR_TRANSACTION_EVENT_NAMES = [
  'Vendor.Transaction.Created',
  'Vendor.Transaction.Updated',
  'Vendor.Transaction.Deleted',
] as const;

const VENDOR_EVENT_NAMES = ['Vendor.Created', 'Vendor.Updated', 'Vendor.Deleted'] as const;

const WORK_ORDER_EVENT_NAMES = [
  'WorkOrder.Created',
  'WorkOrder.Updated',
  'WorkOrder.Deleted',
] as const;

export const BANK_ACCOUNT_EVENT_NAMES = [
  'BankAccount.Created',
  'BankAccount.Updated',
  'BankAccount.Deleted',
] as const;

export const BANK_ACCOUNT_TRANSACTION_EVENT_NAMES = [
  'BankAccount.Transaction.Created',
  'BankAccount.Transaction.Updated',
  'BankAccount.Transaction.Deleted',
] as const;

export const SUPPORTED_EVENT_NAMES = [
  ...GENERAL_EVENT_NAMES,
  ...LEASE_EVENT_NAMES,
  ...LEASE_TRANSACTION_EVENT_NAMES,
  ...LEASE_TENANT_EVENT_NAMES,
  ...MOVE_OUT_EVENT_NAMES,
  ...BILL_PAYMENT_EVENT_NAMES,
  ...BILL_EVENT_NAMES,
  ...GL_ACCOUNT_EVENT_NAMES,
  ...RENTAL_OWNER_EVENT_NAMES,
  ...RENTAL_PROPERTY_EVENT_NAMES,
  ...RENTAL_UNIT_EVENT_NAMES,
  ...TASK_CATEGORY_EVENT_NAMES,
  ...TASK_HISTORY_EVENT_NAMES,
  ...TASK_EVENT_NAMES,
  ...VENDOR_CATEGORY_EVENT_NAMES,
  ...VENDOR_TRANSACTION_EVENT_NAMES,
  ...VENDOR_EVENT_NAMES,
  ...WORK_ORDER_EVENT_NAMES,
  ...BANK_ACCOUNT_EVENT_NAMES,
  ...BANK_ACCOUNT_TRANSACTION_EVENT_NAMES,
] as const;

export type SupportedEventName = (typeof SUPPORTED_EVENT_NAMES)[number];

const EVENT_NAME_ALIAS_MAP = new Map<string, SupportedEventName>([
  ...SUPPORTED_EVENT_NAMES.map((name) => [aliasKey(name), name]),
  // Lease transactions (legacy camelCase)
  ['leasetransactioncreated', 'LeaseTransaction.Created'],
  ['leasetransactionupdated', 'LeaseTransaction.Updated'],
  ['leasetransactiondeleted', 'LeaseTransaction.Deleted'],
  // Lease tenants
  ['leasetenantcreated', 'LeaseTenant.Created'],
  ['leasetenantupdated', 'LeaseTenant.Updated'],
  ['leasetenantdeleted', 'LeaseTenant.Deleted'],
  ['leasetenantmoveout', 'Lease.MoveOut.Created'],
  // Move outs (legacy)
  ['moveoutcreated', 'Lease.MoveOut.Created'],
  ['moveoutupdated', 'Lease.MoveOut.Updated'],
  ['moveoutdeleted', 'Lease.MoveOut.Deleted'],
  // Leases
  ['leasecreated', 'Lease.Created'],
  ['leaseupdated', 'Lease.Updated'],
  ['leasedeleted', 'Lease.Deleted'],
  // Bills
  ['billcreated', 'Bill.Created'],
  ['billupdated', 'Bill.Updated'],
  ['billdeleted', 'Bill.Deleted'],
  // Bill payments (legacy condensed)
  ['billpaymentcreated', 'Bill.Payment.Created'],
  ['billpaymentupdated', 'Bill.Payment.Updated'],
  ['billpaymentdeleted', 'Bill.Payment.Deleted'],
  ['bill.paymentcreated', 'Bill.Payment.Created'],
  ['bill.paymentupdated', 'Bill.Payment.Updated'],
  ['bill.paymentdeleted', 'Bill.Payment.Deleted'],
  // GL accounts
  ['glaccountcreated', 'GLAccount.Created'],
  ['glaccountupdated', 'GLAccount.Updated'],
  ['glaccountdeleted', 'GLAccount.Deleted'],
  // Rentals (compat for RentalProperty)
  ['rentalpropertycreated', 'Rental.Created'],
  ['rentalpropertyupdated', 'Rental.Updated'],
  ['rentalpropertydeleted', 'Rental.Deleted'],
  ['rentalcreated', 'Rental.Created'],
  ['rentalupdated', 'Rental.Updated'],
  ['rentaldeleted', 'Rental.Deleted'],
  // Rental units
  ['rentalunitcreated', 'RentalUnit.Created'],
  ['rentalunitupdated', 'RentalUnit.Updated'],
  ['rentalunitdeleted', 'RentalUnit.Deleted'],
  // Tasks & categories
  ['taskcategorycreated', 'TaskCategory.Created'],
  ['taskcategoryupdated', 'TaskCategory.Updated'],
  ['taskcategorydeleted', 'TaskCategory.Deleted'],
  ['taskcreated', 'Task.Created'],
  ['taskupdated', 'Task.Updated'],
  ['taskdeleted', 'Task.Deleted'],
  ['taskhistorycreated', 'Task.History.Created'],
  ['taskhistoryupdated', 'Task.History.Updated'],
  ['taskhistorydeleted', 'Task.History.Deleted'],
  // Vendors & categories
  ['vendorcreated', 'Vendor.Created'],
  ['vendorupdated', 'Vendor.Updated'],
  ['vendordeleted', 'Vendor.Deleted'],
  ['vendorcategorycreated', 'VendorCategory.Created'],
  ['vendorcategoryupdated', 'VendorCategory.Updated'],
  ['vendorcategorydeleted', 'VendorCategory.Deleted'],
  ['vendortransactioncreated', 'Vendor.Transaction.Created'],
  ['vendortransactionupdated', 'Vendor.Transaction.Updated'],
  ['vendortransactiondeleted', 'Vendor.Transaction.Deleted'],
  // Work orders
  ['workordercreated', 'WorkOrder.Created'],
  ['workorderupdated', 'WorkOrder.Updated'],
  ['workorderdeleted', 'WorkOrder.Deleted'],
  // Bank accounts
  ['bankaccountcreated', 'BankAccount.Created'],
  ['bankaccountupdated', 'BankAccount.Updated'],
  ['bankaccountdeleted', 'BankAccount.Deleted'],
  // Owners
  ['ownercreated', 'Owner.Created'],
  ['ownerupdated', 'Owner.Updated'],
  ['ownerdeleted', 'Owner.Deleted'],
  ['rentalownercreated', 'RentalOwner.Created'],
  ['rentalownerupdated', 'RentalOwner.Updated'],
  ['rentalownerdeleted', 'RentalOwner.Deleted'],
  // Properties
  ['propertycreated', 'Property.Created'],
  ['propertyupdated', 'Property.Updated'],
  ['propertydeleted', 'Property.Deleted'],
] as Array<[string, SupportedEventName]>);

export interface BuildiumWebhookEventLike {
  Id?: string | number;
  EventId?: string | number;
  EventType?: string;
  EventName?: string;
  EventDate?: string | number;
  EventDateTime?: string | number;
  TransactionType?: string;
  EntityId?: number | string;
  LeaseId?: number | string;
  TransactionId?: number | string;
  BillId?: number | string;
  PaymentId?: number | string;
  BillIds?: Array<number | string>;
  GLAccountId?: number | string;
  PropertyId?: number | string;
  UnitId?: number | string;
  TaskId?: number | string;
  TaskCategoryId?: number | string;
  VendorId?: number | string;
  VendorCategoryId?: number | string;
  WorkOrderId?: number | string;
  RentalOwnerId?: number | string;
  TenantId?: number | string;
  AccountId?: number | string;
  BankAccountId?: number | string;
  Data?: Record<string, unknown>;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  eventName: string;
}

type FieldRequirement = {
  label: string;
  paths: string[];
  when?: (evt: BuildiumWebhookEventLike, eventName: string) => boolean;
  validator?: (value: unknown) => boolean;
  message?: string;
};

type EventValidationSpec = {
  group: string;
  eventNames: readonly string[];
  match?: (eventName: string) => boolean;
  required: FieldRequirement[];
};

function aliasKey(name: string): string {
  return name.replace(/[.\s]/g, '').toLowerCase();
}

export function canonicalizeEventName(name?: string | null): string {
  if (!name || typeof name !== 'string') return 'unknown';
  const trimmed = name.trim();
  if (!trimmed.length) return 'unknown';
  const key = aliasKey(trimmed);
  return EVENT_NAME_ALIAS_MAP.get(key) ?? trimmed;
}

function normalizeEventName(evt: BuildiumWebhookEventLike): string {
  const value =
    evt.EventType ||
    evt.EventName ||
    (evt as any)?.eventType ||
    (evt as any)?.type ||
    (typeof evt.Data?.EventType === 'string' ? (evt.Data.EventType as string) : '') ||
    (typeof (evt.Data as any)?.EventName === 'string'
      ? ((evt.Data as any).EventName as string)
      : '') ||
    '';
  if (typeof value !== 'string' || !value.trim().length) return 'unknown';
  return canonicalizeEventName(value);
}

function hasValue(val: unknown): boolean {
  return val !== null && val !== undefined && val !== '';
}

function extractPrimaryIdentifier(evt: BuildiumWebhookEventLike): unknown {
  return (
    evt.Id ??
    evt.EventId ??
    evt.TransactionId ??
    evt.LeaseId ??
    evt.BillId ??
    evt.PaymentId ??
    (Array.isArray(evt.BillIds) && evt.BillIds.length ? evt.BillIds[0] : null) ??
    evt.PropertyId ??
    evt.UnitId ??
    evt.GLAccountId ??
    evt.TaskId ??
    evt.TaskCategoryId ??
    evt.VendorId ??
    evt.VendorCategoryId ??
    evt.WorkOrderId ??
    evt.RentalOwnerId ??
    evt.BankAccountId ??
    evt.AccountId ??
    evt.EntityId ??
    (evt.Data as any)?.TransactionId ??
    (evt.Data as any)?.BillId ??
    (Array.isArray((evt.Data as any)?.BillIds) && (evt.Data as any)?.BillIds.length
      ? (evt.Data as any)?.BillIds[0]
      : null) ??
    (evt.Data as any)?.PropertyId ??
    (evt.Data as any)?.UnitId ??
    (evt.Data as any)?.GLAccountId ??
    (evt.Data as any)?.TaskId ??
    (evt.Data as any)?.TaskCategoryId ??
    (evt.Data as any)?.VendorId ??
    (evt.Data as any)?.VendorCategoryId ??
    (evt.Data as any)?.WorkOrderId ??
    (evt.Data as any)?.RentalOwnerId ??
    (evt.Data as any)?.BankAccountId ??
    (evt.Data as any)?.AccountId ??
    (evt.Data as any)?.Id ??
    null
  );
}

function isValidDateValue(val: unknown): boolean {
  if (typeof val === 'number' && Number.isFinite(val)) {
    const ts = val < 1_000_000_000_000 ? val * 1000 : val;
    return !Number.isNaN(new Date(ts).getTime());
  }
  if (typeof val === 'string' && val.trim().length) {
    const parsed = new Date(val);
    return !Number.isNaN(parsed.getTime());
  }
  return false;
}

function hasValidDate(evt: BuildiumWebhookEventLike): boolean {
  const candidates = [
    evt.EventDate,
    evt.EventDateTime,
    (evt as any).eventDateTime,
    (evt as any).EventTimestamp,
    (evt as any).Timestamp,
    (evt.Data as any)?.EventDate,
    (evt.Data as any)?.EventDateTime,
  ];
  return candidates.some((c) => isValidDateValue(c));
}

function valueAtPath(evt: BuildiumWebhookEventLike, path: string): unknown {
  return path
    .split('.')
    .reduce((acc: any, key) => (acc && key in acc ? acc[key] : undefined), evt as any);
}

function matchesSpec(spec: EventValidationSpec, eventName: string): boolean {
  return spec.eventNames.includes(eventName as any) || (spec.match ? spec.match(eventName) : false);
}

const EVENT_VALIDATION_SPECS: EventValidationSpec[] = [
  {
    group: 'lease-transaction',
    eventNames: LEASE_TRANSACTION_EVENT_NAMES,
    match: (name) => name.toLowerCase().includes('leasetransaction'),
    required: [
      {
        label: 'TransactionId/EntityId',
        paths: ['TransactionId', 'EntityId', 'Data.TransactionId'],
      },
      { label: 'LeaseId', paths: ['LeaseId', 'Data.LeaseId'] },
    ],
  },
  {
    group: 'lease-tenant',
    eventNames: LEASE_TENANT_EVENT_NAMES,
    match: (name) => name.toLowerCase().includes('leasetenant'),
    required: [
      { label: 'TenantId', paths: ['TenantId', 'EntityId', 'Data.TenantId'] },
      {
        label: 'LeaseId',
        paths: ['LeaseId', 'Data.LeaseId'],
        when: (_evt, eventName) => eventName.toLowerCase().includes('moveout'),
      },
    ],
  },
  {
    group: 'lease-moveout',
    eventNames: MOVE_OUT_EVENT_NAMES,
    match: (name) => name.toLowerCase().includes('moveout'),
    required: [
      { label: 'LeaseId', paths: ['LeaseId', 'Data.LeaseId'] },
      { label: 'TenantId', paths: ['TenantId', 'EntityId', 'Data.TenantId'] },
    ],
  },
  {
    group: 'lease',
    eventNames: LEASE_EVENT_NAMES,
    match: (name) =>
      name.toLowerCase().includes('lease') &&
      !name.toLowerCase().includes('leasetransaction') &&
      !name.toLowerCase().includes('leasetenant') &&
      !name.toLowerCase().includes('moveout'),
    required: [{ label: 'LeaseId', paths: ['LeaseId', 'EntityId', 'Data.LeaseId'] }],
  },
  {
    group: 'bill-payment',
    eventNames: BILL_PAYMENT_EVENT_NAMES,
    match: (name) => name.toLowerCase().includes('bill.payment'),
    required: [
      { label: 'PaymentId', paths: ['PaymentId', 'Data.PaymentId', 'Id', 'EventId'] },
      {
        label: 'BillIds',
        paths: ['BillIds', 'Data.BillIds'],
        validator: (val) => Array.isArray(val) && val.length > 0,
        message: 'missing BillIds (non-empty array)',
      },
    ],
  },
  {
    group: 'bill',
    eventNames: BILL_EVENT_NAMES,
    match: (name) => name.toLowerCase().includes('bill') && !name.toLowerCase().includes('payment'),
    required: [{ label: 'BillId', paths: ['BillId', 'EntityId', 'Data.BillId'] }],
  },
  {
    group: 'gl-account',
    eventNames: GL_ACCOUNT_EVENT_NAMES,
    match: (name) => name.toLowerCase().includes('glaccount'),
    required: [{ label: 'GLAccountId', paths: ['GLAccountId', 'EntityId', 'Data.GLAccountId'] }],
  },
  {
    group: 'rental-owner',
    eventNames: RENTAL_OWNER_EVENT_NAMES,
    match: (name) => name.toLowerCase().includes('rentalowner'),
    required: [
      { label: 'RentalOwnerId', paths: ['RentalOwnerId', 'EntityId', 'Data.RentalOwnerId'] },
    ],
  },
  {
    group: 'rental-unit',
    eventNames: RENTAL_UNIT_EVENT_NAMES,
    match: (name) => name.toLowerCase().includes('rentalunit'),
    required: [{ label: 'UnitId', paths: ['UnitId', 'EntityId', 'Data.UnitId'] }],
  },
  {
    group: 'rental-property',
    eventNames: RENTAL_PROPERTY_EVENT_NAMES,
    match: (name) => {
      const lower = name.toLowerCase();
      return lower.includes('rental') && !lower.includes('owner') && !lower.includes('unit');
    },
    required: [{ label: 'PropertyId', paths: ['PropertyId', 'EntityId', 'Data.PropertyId'] }],
  },
  {
    group: 'task-category',
    eventNames: TASK_CATEGORY_EVENT_NAMES,
    match: (name) => name.toLowerCase().includes('taskcategory'),
    required: [
      { label: 'TaskCategoryId', paths: ['TaskCategoryId', 'EntityId', 'Data.TaskCategoryId'] },
    ],
  },
  {
    group: 'task-history',
    eventNames: TASK_HISTORY_EVENT_NAMES,
    match: (name) => name.toLowerCase().includes('task.history'),
    required: [{ label: 'TaskId', paths: ['TaskId', 'EntityId', 'Data.TaskId'] }],
  },
  {
    group: 'task',
    eventNames: TASK_EVENT_NAMES,
    match: (name) =>
      name.toLowerCase().startsWith('task.') && !name.toLowerCase().includes('task.history'),
    required: [{ label: 'TaskId', paths: ['TaskId', 'EntityId', 'Data.TaskId'] }],
  },
  {
    group: 'vendor-category',
    eventNames: VENDOR_CATEGORY_EVENT_NAMES,
    match: (name) => name.toLowerCase().includes('vendorcategory'),
    required: [
      {
        label: 'VendorCategoryId',
        paths: ['VendorCategoryId', 'EntityId', 'Data.VendorCategoryId'],
      },
    ],
  },
  {
    group: 'vendor-transaction',
    eventNames: VENDOR_TRANSACTION_EVENT_NAMES,
    match: (name) => name.toLowerCase().includes('vendor.transaction'),
    required: [{ label: 'VendorId', paths: ['VendorId', 'EntityId', 'Data.VendorId'] }],
  },
  {
    group: 'vendor',
    eventNames: VENDOR_EVENT_NAMES,
    match: (name) =>
      name.toLowerCase().startsWith('vendor.') &&
      !name.toLowerCase().includes('vendorcategory') &&
      !name.toLowerCase().includes('vendor.transaction'),
    required: [{ label: 'VendorId', paths: ['VendorId', 'EntityId', 'Data.VendorId'] }],
  },
  {
    group: 'work-order',
    eventNames: WORK_ORDER_EVENT_NAMES,
    match: (name) => name.toLowerCase().includes('workorder'),
    required: [{ label: 'WorkOrderId', paths: ['WorkOrderId', 'EntityId', 'Data.WorkOrderId'] }],
  },
  {
    group: 'bank-account',
    eventNames: BANK_ACCOUNT_EVENT_NAMES,
    match: (name) => name.toLowerCase().includes('bankaccount'),
    required: [
      { label: 'BankAccountId', paths: ['BankAccountId', 'EntityId', 'Data.BankAccountId'] },
    ],
  },
  {
    group: 'bank-account-transaction',
    eventNames: BANK_ACCOUNT_TRANSACTION_EVENT_NAMES,
    match: (name) => name.toLowerCase().includes('bankaccount.transaction'),
    required: [
      { label: 'BankAccountId', paths: ['BankAccountId', 'EntityId', 'Data.BankAccountId'] },
      { label: 'TransactionId', paths: ['TransactionId', 'EntityId', 'Data.TransactionId'] },
    ],
  },
  {
    group: 'property',
    eventNames: GENERAL_EVENT_NAMES,
    required: [{ label: 'EntityId', paths: ['EntityId'] }],
  },
];

function ensureRequirements(
  evt: BuildiumWebhookEventLike,
  eventName: string,
  spec: EventValidationSpec,
  errors: string[],
) {
  for (const req of spec.required) {
    if (req.when && !req.when(evt, eventName)) continue;
    const satisfied = req.paths.some((p) => {
      const value = valueAtPath(evt, p);
      if (req.validator) return req.validator(value);
      return hasValue(value);
    });
    if (!satisfied) {
      errors.push(req.message || `missing ${req.label}`);
    }
  }
}

export function validateBuildiumEvent(evt: BuildiumWebhookEventLike): ValidationResult {
  const errors: string[] = [];
  const eventName = normalizeEventName(evt);
  const spec = EVENT_VALIDATION_SPECS.find((s) => matchesSpec(s, eventName));

  if (!hasValue(extractPrimaryIdentifier(evt))) {
    errors.push('missing event identifier (Id/EventId/TransactionId/LeaseId/EntityId)');
  }

  if (!hasValidDate(evt)) {
    errors.push('missing or invalid EventDate/EventDateTime');
  }

  if (!spec) {
    errors.push('unsupported EventName');
  } else {
    ensureRequirements(evt, eventName, spec, errors);
  }

  return { ok: errors.length === 0, errors, eventName };
}
