import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts"
import { validateBuildiumEvent } from "./eventValidation.ts"

Deno.test('accepts valid property event', () => {
  const res = validateBuildiumEvent({
    Id: 'evt-1',
    EventType: 'PropertyCreated',
    EventDate: '2024-01-01T00:00:00Z',
    EntityId: 123,
  })
  assert(res.ok)
})

Deno.test('rejects missing EntityId on property event', () => {
  const res = validateBuildiumEvent({
    Id: 'evt-2',
    EventType: 'PropertyUpdated',
    EventDate: '2024-01-01T00:00:00Z',
  })
  assertEquals(res.ok, false)
  assert(res.errors.some((e) => e.includes('EntityId')))
})

Deno.test('rejects unsupported EventName', () => {
  const res = validateBuildiumEvent({
    Id: 'evt-3',
    EventType: 'UnknownThing',
    EventDate: '2024-01-01T00:00:00Z',
    EntityId: 1,
  })
  assertEquals(res.ok, false)
  assert(res.errors.includes('unsupported EventName'))
})

Deno.test('requires lease transaction fields', () => {
  const res = validateBuildiumEvent({
    Id: 'evt-4',
    EventType: 'LeaseTransactionCreated',
    EventDate: '2024-01-01T00:00:00Z',
    LeaseId: 42,
  })
  assertEquals(res.ok, false)
  assert(res.errors.some((e) => e.includes('TransactionId')))
})

Deno.test('requires BillId on bill events', () => {
  const res = validateBuildiumEvent({
    Id: 'evt-bill',
    EventType: 'BillUpdated',
    EventDate: '2024-01-01T00:00:00Z',
    BillId: 123,
  })
  assert(res.ok)

  const missing = validateBuildiumEvent({
    Id: 'evt-bill-missing',
    EventType: 'BillUpdated',
    EventDate: '2024-01-01T00:00:00Z',
  })
  assertEquals(missing.ok, false)
  assert(missing.errors.some((e) => e.toLowerCase().includes('billid')))
})

Deno.test('requires PaymentId and BillIds on bill payment events', () => {
  const ok = validateBuildiumEvent({
    Id: 'evt-payment',
    EventType: 'Bill.PaymentUpdated',
    EventDate: '2024-01-01T00:00:00Z',
    PaymentId: 99,
    BillIds: [1, 2],
  })
  assert(ok.ok)

  const missingBills = validateBuildiumEvent({
    Id: 'evt-payment-missing',
    EventType: 'Bill.PaymentUpdated',
    EventDate: '2024-01-01T00:00:00Z',
    PaymentId: 99,
  })
  assertEquals(missingBills.ok, false)
  assert(missingBills.errors.some((e) => e.toLowerCase().includes('billids')))
})

Deno.test('requires lease and tenant on move out events', () => {
  const res = validateBuildiumEvent({
    Id: 'evt-moveout',
    EventType: 'MoveOutCreated',
    EventDate: '2024-01-01T00:00:00Z',
    TenantId: 5,
  })
  assertEquals(res.ok, false)
  assert(res.errors.some((e) => e.toLowerCase().includes('leaseid')))
})

Deno.test('requires GLAccountId on GLAccount events', () => {
  const res = validateBuildiumEvent({
    Id: 'evt-gl',
    EventType: 'GLAccountCreated',
    EventDate: '2024-01-01T00:00:00Z',
    GLAccountId: 77,
  })
  assert(res.ok)
})
