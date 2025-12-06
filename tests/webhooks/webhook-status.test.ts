import assert from 'node:assert'
import test from 'node:test'
import { markWebhookError, markWebhookTombstone, type BuildiumWebhookKey } from '../../src/lib/buildium-webhook-status'

class FakeSupabase {
  updates: any[] = []
  from() {
    return {
      update: (payload: any) => {
        return {
          eq: (_field: string, _value: any) => ({
            eq: (_f2: string, _v2: any) => ({
              eq: (_f3: string, _v3: any) => {
                this.updates.push(payload)
                return this
              },
            }),
          }),
        }
      },
    }
  }
}

const key: BuildiumWebhookKey = {
  buildiumWebhookId: 'evt-1',
  eventName: 'LeaseUpdated',
  eventCreatedAt: '2024-01-01T00:00:00.000Z',
}

test('markWebhookError marks error status', async () => {
  const client = new FakeSupabase()
  await markWebhookError(client as any, key, 'missing property')
  assert.strictEqual(client.updates.length, 1)
  assert.strictEqual(client.updates[0].status, 'error')
  assert.strictEqual(client.updates[0].error, 'missing property')
  assert.strictEqual(client.updates[0].processed, false)
})

test('markWebhookTombstone marks tombstoned and processed', async () => {
  const client = new FakeSupabase()
  await markWebhookTombstone(client as any, key, 'entity already absent')
  assert.strictEqual(client.updates.length, 1)
  assert.strictEqual(client.updates[0].status, 'tombstoned')
  assert.strictEqual(client.updates[0].error, 'entity already absent')
  assert.strictEqual(client.updates[0].processed, true)
  assert(client.updates[0].processed_at)
})
