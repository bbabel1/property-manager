import { assert, assertEquals, assertStringIncludes } from "https://deno.land/std@0.168.0/testing/asserts.ts"
import { insertBuildiumWebhookEventRecord, normalizeBuildiumWebhookEvent } from "./webhookEvents.ts"

class FakeSupabase {
  private rows: any[] = []
  private dedupe = new Map<string, string>()

  from(table: string) {
    if (table !== 'buildium_webhook_events') {
      throw new Error(`Unexpected table ${table}`)
    }
    return {
      insert: (payload: any) => {
        const row = Array.isArray(payload) ? payload[0] : payload
        const key = `${row.buildium_webhook_id}|${row.event_name}|${row.event_created_at}`
        if (this.dedupe.has(key)) {
          return {
            data: null,
            error: { code: '23505', message: 'duplicate key value violates unique constraint' },
          }
        }
        const id = `id-${this.rows.length + 1}`
        this.rows.push({ ...row, id })
        this.dedupe.set(key, id)
        return {
          select: () => ({
            maybeSingle: async () => ({ data: { id }, error: null }),
          }),
        }
      },
      select: () => ({
        eq: (field: string, value: any) => {
          const filtered = this.rows.filter((r) => r[field] === value)
          return {
            eq: (field2: string, value2: any) => {
              const filtered2 = filtered.filter((r) => r[field2] === value2)
              return {
                eq: (field3: string, value3: any) => {
                  const filtered3 = filtered2.filter((r) => r[field3] === value3)
                  return {
                    maybeSingle: async () => ({ data: filtered3[0] ?? null, error: null }),
                  }
                },
              }
            },
            maybeSingle: async () => ({ data: filtered[0] ?? null, error: null }),
          }
        },
        maybeSingle: async () => ({ data: this.rows[0] ?? null, error: null }),
      }),
    }
  }
}

Deno.test('normalizeBuildiumWebhookEvent derives stable keys', () => {
  const meta = normalizeBuildiumWebhookEvent({
    Id: 'evt-123',
    EventType: 'LeaseTransaction.Created',
    EventDate: '2024-01-01T00:00:00Z',
    EntityId: 987,
  })
  assertEquals(meta.buildiumWebhookId, 'evt-123')
  assertEquals(meta.eventName, 'LeaseTransaction.Created')
  assertStringIncludes(meta.eventCreatedAt, '2024-01-01T00:00:00.000Z')
  assertEquals(meta.eventEntityId, '987')
})

Deno.test('insertBuildiumWebhookEventRecord flags duplicates', async () => {
  const supabase = new FakeSupabase()
  const event = { Id: 'evt-dup', EventType: 'LeaseTransaction.Created', EventDate: '2024-02-02T12:00:00Z' }

  const first = await insertBuildiumWebhookEventRecord(supabase, event, { webhookType: 'lease-transactions' })
  const second = await insertBuildiumWebhookEventRecord(supabase, event, { webhookType: 'lease-transactions' })

  assertEquals(first.status, 'inserted')
  assertEquals(second.status, 'duplicate')
  assert(second.id === null || typeof second.id === 'string')
})

Deno.test('normalizeBuildiumWebhookEvent tolerates partial events', () => {
  const meta = normalizeBuildiumWebhookEvent({})
  assertEquals(meta.eventName, 'unknown')
  assertEquals(meta.eventEntityId, 'unknown')
  assert(meta.buildiumWebhookId.includes('unknown'))
})

Deno.test('insertBuildiumWebhookEventRecord handles unknown EventName and missing ids', async () => {
  const supabase = new FakeSupabase()
  const event = { EventDate: '2024-03-03T00:00:00Z' } // missing Id/EventType
  const result = await insertBuildiumWebhookEventRecord(supabase, event, { webhookType: 'buildium-webhook' })
  assertEquals(result.status, 'inserted')
  assertStringIncludes(result.normalized.eventName, 'unknown')
  assertEquals(result.normalized.eventEntityId, 'unknown')
})
