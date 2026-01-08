// deno-lint-ignore-file
import {
  BANK_ACCOUNT_EVENT_NAMES,
  BANK_ACCOUNT_TRANSACTION_EVENT_NAMES,
  BILL_PAYMENT_EVENT_NAMES,
  GENERAL_EVENT_NAMES,
  LEASE_TRANSACTION_EVENT_NAMES,
  SUPPORTED_EVENT_NAMES,
  VENDOR_TRANSACTION_EVENT_NAMES,
  canonicalizeEventName,
} from "./eventValidation.ts"

const SUPPORTED_EVENT_SET = new Set<string>(SUPPORTED_EVENT_NAMES as unknown as string[])
const GENERAL_HANDLED_SET = new Set<string>([
  ...(GENERAL_EVENT_NAMES as unknown as string[]),
  ...(BILL_PAYMENT_EVENT_NAMES as unknown as string[]),
  ...(VENDOR_TRANSACTION_EVENT_NAMES as unknown as string[]),
])
const LEASE_TX_HANDLED_SET = new Set<string>(LEASE_TRANSACTION_EVENT_NAMES as unknown as string[])
const BANK_TX_HANDLED_SET = new Set<string>(BANK_ACCOUNT_TRANSACTION_EVENT_NAMES as unknown as string[])
const BANK_ACCOUNT_HANDLED_SET = new Set<string>(BANK_ACCOUNT_EVENT_NAMES as unknown as string[])

export type RoutingDecision = 'process' | 'skip' | 'dead-letter'

export function routeGeneralWebhookEvent(eventType: string): RoutingDecision {
  const normalized = canonicalizeEventName(eventType)
  eventType = normalized
  if (GENERAL_HANDLED_SET.has(eventType) || BANK_TX_HANDLED_SET.has(eventType) || BANK_ACCOUNT_HANDLED_SET.has(eventType)) return 'process'
  if (SUPPORTED_EVENT_SET.has(eventType)) return 'skip'
  return 'dead-letter'
}

export function routeLeaseTransactionWebhookEvent(eventType: string): RoutingDecision {
  const normalized = canonicalizeEventName(eventType)
  eventType = normalized
  if (LEASE_TX_HANDLED_SET.has(eventType)) return 'process'
  if (SUPPORTED_EVENT_SET.has(eventType)) return 'skip'
  return 'dead-letter'
}
