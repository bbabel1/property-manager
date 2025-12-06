import test from 'node:test'
import assert from 'node:assert'
import { DELETE_EVENT_NAMES, isDeleteEventName, looksLikeDelete } from '../../src/lib/buildium-delete-map'

test('isDeleteEventName matches canonical names case-insensitively', () => {
  for (const name of DELETE_EVENT_NAMES) {
    assert.ok(isDeleteEventName(name))
    assert.ok(isDeleteEventName(name.toLowerCase()))
  }
  assert.ok(!isDeleteEventName('LeaseUpdated'))
})

test('looksLikeDelete flags mapped names and generic deleted strings', () => {
  const mapped = { EventType: 'BillDeleted' }
  assert.ok(looksLikeDelete(mapped))
  const generic = { EventType: 'SomethingDeleted' }
  assert.ok(looksLikeDelete(generic))
  const nonDelete = { EventType: 'BillUpdated' }
  assert.ok(!looksLikeDelete(nonDelete))
})
