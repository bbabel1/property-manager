export const GENERAL_EVENT_NAMES = [
  'PropertyCreated',
  'PropertyUpdated',
  'OwnerCreated',
  'OwnerUpdated',
  'LeaseCreated',
  'LeaseUpdated',
] as const

export const LEASE_TRANSACTION_EVENT_NAMES = [
  'LeaseTransactionCreated',
  'LeaseTransactionUpdated',
  'LeaseTransactionDeleted',
  'LeaseTransaction.Deleted',
] as const

export type SupportedEventName = typeof GENERAL_EVENT_NAMES[number] | typeof LEASE_TRANSACTION_EVENT_NAMES[number]

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
  Data?: Record<string, unknown>
}

export interface ValidationResult {
  ok: boolean
  errors: string[]
  eventName: string
}

function normalizeEventName(evt: BuildiumWebhookEventLike): string {
  return (
    evt.EventType ||
    evt.EventName ||
    (typeof evt.Data?.EventType === 'string' ? (evt.Data.EventType as string) : '') ||
    'unknown'
  )
}

function hasValue(val: unknown): boolean {
  return val !== null && val !== undefined && val !== ''
}

export function validateBuildiumEvent(evt: BuildiumWebhookEventLike): ValidationResult {
  const errors: string[] = []
  const eventName = normalizeEventName(evt)
  const isLeaseTransaction = eventName.includes('LeaseTransaction')
  const isGeneralSupported = GENERAL_EVENT_NAMES.includes(eventName as any)

  if (!hasValue(evt.Id) && !hasValue(evt.EventId)) {
    errors.push('missing Id/EventId')
  }

  if (!hasValue(evt.EventDate) && !hasValue(evt.EventDateTime)) {
    errors.push('missing EventDate/EventDateTime')
  }

  if (isLeaseTransaction) {
    if (!hasValue(evt.TransactionId) && !hasValue(evt.EntityId) && !hasValue(evt.Data?.TransactionId)) {
      errors.push('missing TransactionId/EntityId')
    }
    if (!hasValue(evt.LeaseId) && !hasValue(evt.Data?.LeaseId)) {
      errors.push('missing LeaseId')
    }
  } else if (isGeneralSupported) {
    if (!hasValue(evt.EntityId)) {
      errors.push('missing EntityId')
    }
  } else {
    errors.push('unsupported EventName')
  }

  return { ok: errors.length === 0, errors, eventName }
}
