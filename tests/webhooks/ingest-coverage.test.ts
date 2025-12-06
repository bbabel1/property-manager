import assert from 'node:assert'
import test from 'node:test'
import { buildiumEventFixtures } from '../fixtures/buildium-events'
import { SUPPORTED_EVENT_NAMES, validateBuildiumEvent, canonicalizeEventName } from '../../supabase/functions/_shared/eventValidation'
import { looksLikeDelete, DELETE_EVENT_NAMES } from '../../src/lib/buildium-delete-map'
import { normalizeBuildiumWebhookEvent } from '../../supabase/functions/_shared/webhookEvents'

test('all fixtures align with supported EventNames and validation', () => {
  const fixtureEventNames = new Set(
    buildiumEventFixtures.map((f) =>
      canonicalizeEventName((f.event.EventType || f.event.EventName || '').toString())
    )
  )
  for (const supported of SUPPORTED_EVENT_NAMES) {
    assert.ok(
      fixtureEventNames.has(supported as string),
      `Missing fixture for supported EventName ${supported as string}`
    )
  }
  for (const fixture of buildiumEventFixtures) {
    const { event, name, valid = true } = fixture
    const eventType = canonicalizeEventName((event.EventType || event.EventName || '').toString())
    if (valid) {
      assert.ok(
        SUPPORTED_EVENT_NAMES.includes(eventType as any),
        `Fixture ${name} uses unsupported EventName ${eventType}`
      )
    }
    const res = validateBuildiumEvent(event)
    if (valid) {
      assert.ok(res.ok, `Fixture ${name} should validate but failed: ${res.errors.join(', ')}`)
    } else {
      assert.ok(!res.ok, `Fixture ${name} should fail validation`)
    }
  }
})

test('delete fixtures are detected by delete map', () => {
  for (const fixture of buildiumEventFixtures) {
    const isDelete = (fixture.event.EventType || '').toString().toLowerCase().includes('deleted')
    if (isDelete) {
      assert.ok(looksLikeDelete(fixture.event), `Delete fixture ${fixture.name} not recognized as delete`)
    }
  }
  const fixtureDeleteNames = new Set(
    buildiumEventFixtures
      .filter((f) => looksLikeDelete(f.event))
      .map((f) => canonicalizeEventName((f.event.EventType || f.event.EventName || '').toString()).toLowerCase())
  )
  for (const del of DELETE_EVENT_NAMES) {
    assert.ok(fixtureDeleteNames.has(del.toLowerCase()), `Missing delete fixture for ${del}`)
  }
})

test('normalization rejects malformed fixtures and keeps required keys', () => {
  for (const fixture of buildiumEventFixtures) {
    const result = normalizeBuildiumWebhookEvent(fixture.event as any)
    if (fixture.valid === false) {
      assert.strictEqual(result.ok, false, `Expected normalization failure for ${fixture.name}`)
    } else {
      assert.ok(result.ok, `Normalization failed for ${fixture.name}`)
      const norm = result.normalized!
      assert.ok(norm.buildiumWebhookId, 'missing buildiumWebhookId')
      assert.ok(norm.eventCreatedAt, 'missing eventCreatedAt')
    }
  }
})
