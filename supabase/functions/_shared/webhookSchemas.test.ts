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
        EventType: 'PropertyCreated',
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

Deno.test('routing decisions are explicit', () => {
  assertEquals(routeGeneralWebhookEvent('PropertyCreated'), 'process')
  assertEquals(routeGeneralWebhookEvent('VendorCreated'), 'skip')
  assertEquals(routeLeaseTransactionWebhookEvent('LeaseTransactionCreated'), 'process')
  assertEquals(routeLeaseTransactionWebhookEvent('LeaseCreated'), 'skip')
  assertEquals(routeLeaseTransactionWebhookEvent('TotallyUnknown'), 'dead-letter')
})
