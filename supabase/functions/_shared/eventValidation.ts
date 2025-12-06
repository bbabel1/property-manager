export const GENERAL_EVENT_NAMES = [
  'PropertyCreated',
  'PropertyUpdated',
  'OwnerCreated',
  'OwnerUpdated',
  'LeaseCreated',
  'LeaseUpdated',
] as const

const LEASE_EVENT_NAMES = [
  'LeaseCreated',
  'LeaseUpdated',
  'LeaseDeleted',
  'Lease.Deleted',
] as const

export const LEASE_TRANSACTION_EVENT_NAMES = [
  'LeaseTransactionCreated',
  'LeaseTransactionUpdated',
  'LeaseTransactionDeleted',
  'LeaseTransaction.Deleted',
] as const

const LEASE_TENANT_EVENT_NAMES = [
  'LeaseTenantCreated',
  'LeaseTenantUpdated',
  'LeaseTenantDeleted',
  'LeaseTenantMoveOut',
  'LeaseTenant.MoveOut',
] as const

const MOVE_OUT_EVENT_NAMES = [
  'MoveOutCreated',
  'MoveOutUpdated',
  'MoveOutDeleted',
  'MoveOut.Deleted',
] as const

const BILL_PAYMENT_EVENT_NAMES = [
  'Bill.PaymentCreated',
  'Bill.PaymentUpdated',
  'Bill.PaymentDeleted',
  'BillPaymentCreated',
  'BillPaymentUpdated',
  'BillPaymentDeleted',
] as const

const BILL_EVENT_NAMES = [
  'BillCreated',
  'BillUpdated',
  'BillDeleted',
  'Bill.Deleted',
] as const

const GL_ACCOUNT_EVENT_NAMES = [
  'GLAccountCreated',
  'GLAccountUpdated',
  'GLAccountDeleted',
  'GLAccount.Deleted',
] as const

const RENTAL_OWNER_EVENT_NAMES = [
  'RentalOwnerCreated',
  'RentalOwnerUpdated',
  'RentalOwnerDeleted',
  'RentalOwner.Deleted',
] as const

const RENTAL_PROPERTY_EVENT_NAMES = [
  'RentalCreated',
  'RentalUpdated',
  'RentalDeleted',
  'Rental.Deleted',
  'RentalPropertyCreated',
  'RentalPropertyUpdated',
  'RentalPropertyDeleted',
  'RentalProperty.Deleted',
] as const

const RENTAL_UNIT_EVENT_NAMES = [
  'RentalUnitCreated',
  'RentalUnitUpdated',
  'RentalUnitDeleted',
  'RentalUnit.Deleted',
] as const

const TASK_CATEGORY_EVENT_NAMES = [
  'TaskCategoryCreated',
  'TaskCategoryUpdated',
  'TaskCategoryDeleted',
  'TaskCategory.Deleted',
] as const

const TASK_EVENT_NAMES = [
  'TaskCreated',
  'TaskUpdated',
  'TaskDeleted',
  'Task.Deleted',
] as const

const VENDOR_CATEGORY_EVENT_NAMES = [
  'VendorCategoryCreated',
  'VendorCategoryUpdated',
  'VendorCategoryDeleted',
  'VendorCategory.Deleted',
] as const

const VENDOR_EVENT_NAMES = [
  'VendorCreated',
  'VendorUpdated',
  'VendorDeleted',
  'Vendor.Deleted',
] as const

const WORK_ORDER_EVENT_NAMES = [
  'WorkOrderCreated',
  'WorkOrderUpdated',
  'WorkOrderDeleted',
  'WorkOrder.Deleted',
] as const

const BANK_ACCOUNT_EVENT_NAMES = [
  'BankAccountCreated',
  'BankAccountUpdated',
  'BankAccountDeleted',
  'BankAccount.Deleted',
] as const

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
  ...TASK_EVENT_NAMES,
  ...VENDOR_CATEGORY_EVENT_NAMES,
  ...VENDOR_EVENT_NAMES,
  ...WORK_ORDER_EVENT_NAMES,
  ...BANK_ACCOUNT_EVENT_NAMES,
] as const

export type SupportedEventName = typeof SUPPORTED_EVENT_NAMES[number]

export interface BuildiumWebhookEventLike {
  Id?: string
  EventId?: string
  EventType?: string
  EventName?: string
  EventDate?: string
  EventDateTime?: string
  EntityId?: number
  LeaseId?: number
  TransactionId?: number
  BillId?: number
  PaymentId?: number
  BillIds?: number[]
  GLAccountId?: number
  PropertyId?: number
  UnitId?: number
  TaskId?: number
  TaskCategoryId?: number
  VendorId?: number
  VendorCategoryId?: number
  WorkOrderId?: number
  RentalOwnerId?: number
  TenantId?: number
  AccountId?: number
  BankAccountId?: number
  Data?: Record<string, unknown>
}

export interface ValidationResult {
  ok: boolean
  errors: string[]
  eventName: string
}

type FieldRequirement = {
  label: string
  paths: string[]
  when?: (evt: BuildiumWebhookEventLike, eventName: string) => boolean
  validator?: (value: unknown) => boolean
  message?: string
}

type EventValidationSpec = {
  group: string
  eventNames: readonly string[]
  match?: (eventName: string) => boolean
  required: FieldRequirement[]
}

function normalizeEventName(evt: BuildiumWebhookEventLike): string {
  const value =
    evt.EventType ||
    evt.EventName ||
    (evt as any)?.eventType ||
    (evt as any)?.type ||
    (typeof evt.Data?.EventType === 'string' ? (evt.Data.EventType as string) : '') ||
    (typeof (evt.Data as any)?.EventName === 'string' ? ((evt.Data as any).EventName as string) : '') ||
    ''
  return typeof value === 'string' && value.trim().length ? value : 'unknown'
}

function hasValue(val: unknown): boolean {
  return val !== null && val !== undefined && val !== ''
}

function isValidDateValue(val: unknown): boolean {
  if (typeof val === 'number' && Number.isFinite(val)) {
    const ts = val < 1_000_000_000_000 ? val * 1000 : val
    return !Number.isNaN(new Date(ts).getTime())
  }
  if (typeof val === 'string' && val.trim().length) {
    const parsed = new Date(val)
    return !Number.isNaN(parsed.getTime())
  }
  return false
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
  ]
  return candidates.some((c) => isValidDateValue(c))
}

function valueAtPath(evt: BuildiumWebhookEventLike, path: string): unknown {
  return path.split('.').reduce((acc: any, key) => (acc && key in acc ? acc[key] : undefined), evt as any)
}

function matchesSpec(spec: EventValidationSpec, eventName: string): boolean {
  return spec.eventNames.includes(eventName as any) || (spec.match ? spec.match(eventName) : false)
}

const EVENT_VALIDATION_SPECS: EventValidationSpec[] = [
  {
    group: 'lease-transaction',
    eventNames: LEASE_TRANSACTION_EVENT_NAMES,
    match: (name) => name.toLowerCase().includes('leasetransaction'),
    required: [
      { label: 'TransactionId/EntityId', paths: ['TransactionId', 'EntityId', 'Data.TransactionId'] },
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
    required: [{ label: 'RentalOwnerId', paths: ['RentalOwnerId', 'EntityId', 'Data.RentalOwnerId'] }],
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
      const lower = name.toLowerCase()
      return lower.includes('rental') && !lower.includes('owner') && !lower.includes('unit')
    },
    required: [{ label: 'PropertyId', paths: ['PropertyId', 'EntityId', 'Data.PropertyId'] }],
  },
  {
    group: 'task-category',
    eventNames: TASK_CATEGORY_EVENT_NAMES,
    match: (name) => name.toLowerCase().includes('taskcategory'),
    required: [{ label: 'TaskCategoryId', paths: ['TaskCategoryId', 'EntityId', 'Data.TaskCategoryId'] }],
  },
  {
    group: 'task',
    eventNames: TASK_EVENT_NAMES,
    match: (name) => name.toLowerCase().includes('task'),
    required: [{ label: 'TaskId', paths: ['TaskId', 'EntityId', 'Data.TaskId'] }],
  },
  {
    group: 'vendor-category',
    eventNames: VENDOR_CATEGORY_EVENT_NAMES,
    match: (name) => name.toLowerCase().includes('vendorcategory'),
    required: [{ label: 'VendorCategoryId', paths: ['VendorCategoryId', 'EntityId', 'Data.VendorCategoryId'] }],
  },
  {
    group: 'vendor',
    eventNames: VENDOR_EVENT_NAMES,
    match: (name) => name.toLowerCase().includes('vendor'),
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
    required: [{ label: 'BankAccountId', paths: ['BankAccountId', 'EntityId', 'Data.BankAccountId'] }],
  },
  {
    group: 'property',
    eventNames: GENERAL_EVENT_NAMES,
    required: [{ label: 'EntityId', paths: ['EntityId'] }],
  },
]

function ensureRequirements(
  evt: BuildiumWebhookEventLike,
  eventName: string,
  spec: EventValidationSpec,
  errors: string[]
) {
  for (const req of spec.required) {
    if (req.when && !req.when(evt, eventName)) continue
    const satisfied = req.paths.some((p) => {
      const value = valueAtPath(evt, p)
      if (req.validator) return req.validator(value)
      return hasValue(value)
    })
    if (!satisfied) {
      errors.push(req.message || `missing ${req.label}`)
    }
  }
}

export function validateBuildiumEvent(evt: BuildiumWebhookEventLike): ValidationResult {
  const errors: string[] = []
  const eventName = normalizeEventName(evt)
  const spec = EVENT_VALIDATION_SPECS.find((s) => matchesSpec(s, eventName))

  if (!hasValue(evt.Id) && !hasValue(evt.EventId)) {
    errors.push('missing Id/EventId')
  }

  if (!hasValidDate(evt)) {
    errors.push('missing or invalid EventDate/EventDateTime')
  }

  if (!spec) {
    errors.push('unsupported EventName')
  } else {
    ensureRequirements(evt, eventName, spec, errors)
  }

  return { ok: errors.length === 0, errors, eventName }
}
