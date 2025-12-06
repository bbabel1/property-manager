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
