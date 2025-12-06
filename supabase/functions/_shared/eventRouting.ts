import { GENERAL_EVENT_NAMES, LEASE_TRANSACTION_EVENT_NAMES, SUPPORTED_EVENT_NAMES } from "./eventValidation.ts"

const SUPPORTED_EVENT_SET = new Set<string>(SUPPORTED_EVENT_NAMES as unknown as string[])
const GENERAL_HANDLED_SET = new Set<string>(GENERAL_EVENT_NAMES as unknown as string[])
const LEASE_TX_HANDLED_SET = new Set<string>(LEASE_TRANSACTION_EVENT_NAMES as unknown as string[])

export type RoutingDecision = 'process' | 'skip' | 'dead-letter'

export function routeGeneralWebhookEvent(eventType: string): RoutingDecision {
  if (GENERAL_HANDLED_SET.has(eventType)) return 'process'
  if (SUPPORTED_EVENT_SET.has(eventType)) return 'skip'
  return 'dead-letter'
}

export function routeLeaseTransactionWebhookEvent(eventType: string): RoutingDecision {
  if (LEASE_TX_HANDLED_SET.has(eventType)) return 'process'
  if (SUPPORTED_EVENT_SET.has(eventType)) return 'skip'
  return 'dead-letter'
}
