import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts"
import { routeGeneralWebhookEvent, routeLeaseTransactionWebhookEvent } from "./eventRouting.ts"
import {
  BuildiumWebhookPayloadSchema,
  LeaseTransactionsWebhookPayloadSchema,
  validateWebhookPayload,
} from "./webhookSchemas.ts"

Deno.test('accepts valid buildium webhook payload', () => {
  const payload = {
    Events: [
      {
        Id: 'evt-1',
        EventType: 'Property.Created',
        EventDate: '2024-01-01T00:00:00Z',
        EntityId: 1,
      },
    ],
  }
  const result = validateWebhookPayload(payload, BuildiumWebhookPayloadSchema)
  assert(result.ok)
})

Deno.test('rejects missing Events array', () => {
  const result = validateWebhookPayload({}, BuildiumWebhookPayloadSchema)
  assertEquals(result.ok, false)
  if (!result.ok) {
    assert(result.errors.some((e) => e.includes('Events')))
  }
})

Deno.test('rejects unsupported EventType', () => {
  const payload = {
    Events: [
      {
        Id: 'evt-unsupported',
        EventType: 'TotallyUnknown',
        EventDate: '2024-01-01T00:00:00Z',
        EntityId: 9,
      },
    ],
  }
  const result = validateWebhookPayload(payload, BuildiumWebhookPayloadSchema)
  assertEquals(result.ok, false)
  if (!result.ok) {
    assert(result.errors.some((e) => e.toLowerCase().includes('unsupported')))
  }
})

Deno.test('accepts lease transaction payload with credentials', () => {
  const payload = {
    Events: [
      {
        Id: 'evt-lease',
        EventType: 'LeaseTransactionCreated',
        EventDate: '2024-02-02T00:00:00Z',
        EntityId: 22,
        LeaseId: 300,
        TransactionId: 400,
      },
    ],
    credentials: {
      baseUrl: 'https://apisandbox.buildium.com/v1',
      clientId: 'abc',
      clientSecret: 'def',
    },
  }

  const result = validateWebhookPayload(payload, LeaseTransactionsWebhookPayloadSchema)
  assert(result.ok)
})

Deno.test('accepts dotted lease transaction event names', () => {
  const payload = {
    Events: [
      {
        Id: 'evt-lease-dotted',
        EventType: 'LeaseTransaction.Created',
        EventDateTime: '2024-03-03T00:00:00Z',
        EntityId: 33,
        LeaseId: 123,
        TransactionId: 456,
      },
    ],
  }

  const result = validateWebhookPayload(payload, LeaseTransactionsWebhookPayloadSchema)
  assert(result.ok)
})

Deno.test('accepts lease transaction payload without Id when TransactionId present', () => {
  const payload = {
    Events: [
      {
        EventType: 'LeaseTransaction.Created',
        EventDateTime: '2024-03-03T00:00:00Z',
        LeaseId: 123,
        TransactionId: 456,
      },
    ],
  }

  const result = validateWebhookPayload(payload, LeaseTransactionsWebhookPayloadSchema)
  assert(result.ok)
})

Deno.test('routing decisions are explicit', () => {
  assertEquals(routeGeneralWebhookEvent('Property.Created'), 'process')
  assertEquals(routeGeneralWebhookEvent('Vendor.Created'), 'skip')
  assertEquals(routeLeaseTransactionWebhookEvent('LeaseTransactionCreated'), 'process')
  assertEquals(routeLeaseTransactionWebhookEvent('LeaseTransaction.Created'), 'process')
  assertEquals(routeLeaseTransactionWebhookEvent('Lease.Created'), 'skip')
  assertEquals(routeLeaseTransactionWebhookEvent('TotallyUnknown'), 'dead-letter')
})
