import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts"
import { signBuildiumPayload, verifyBuildiumSignature } from "./buildiumSignature.ts"

const secret = 'test-shared-secret'
const rawBody = JSON.stringify({ hello: 'world' })
const timestamp = '1700000000000'
const timestampMs = Number(timestamp)

Deno.test('accepts a valid Buildium signature', async () => {
  const signature = await signBuildiumPayload(rawBody, secret, timestamp)
  const headers = new Headers({
    'x-buildium-signature': signature,
    'buildium-webhook-timestamp': timestamp,
  })

  const result = await verifyBuildiumSignature(headers, rawBody, {
    secret,
    now: timestampMs,
    replayCache: new Map(),
  })

  assert(result.ok, 'Expected signature to verify')
  assertEquals(result.signature, signature)
})

Deno.test('rejects an invalid signature', async () => {
  const headers = new Headers({
    'x-buildium-signature': 'not-a-real-signature',
    'buildium-webhook-timestamp': timestamp,
  })

  const result = await verifyBuildiumSignature(headers, rawBody, {
    secret,
    now: timestampMs,
    replayCache: new Map(),
  })

  assertEquals(result.ok, false)
  if (!result.ok) {
    assertEquals(result.reason, 'invalid-signature')
  }
})

Deno.test('rejects a request without a signature header', async () => {
  const headers = new Headers({
    'buildium-webhook-timestamp': timestamp,
  })

  const result = await verifyBuildiumSignature(headers, rawBody, {
    secret,
    now: timestampMs,
    replayCache: new Map(),
  })

  assertEquals(result.ok, false)
  if (!result.ok) {
    assertEquals(result.reason, 'missing-signature')
  }
})

Deno.test('rejects replayed signatures within the window', async () => {
  const signature = await signBuildiumPayload(rawBody, secret, timestamp)
  const headers = new Headers({
    'x-buildium-signature': signature,
    'buildium-webhook-timestamp': timestamp,
  })
  const replayCache = new Map<string, number>()

  const first = await verifyBuildiumSignature(headers, rawBody, {
    secret,
    now: timestampMs,
    replayCache,
  })
  const second = await verifyBuildiumSignature(headers, rawBody, {
    secret,
    now: timestampMs + 1000,
    replayCache,
  })

  assert(first.ok, 'First request should pass')
  assertEquals(second.ok, false)
  if (!second.ok) {
    assertEquals(second.reason, 'replayed-signature')
  }
})
