import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateMembershipChange } from '../src/lib/auth/membership-authz'

test('denies when caller is not admin in target org', () => {
  const result = validateMembershipChange({
    callerOrgRole: 'org_staff' as any,
    callerGlobalRoles: ['org_staff'],
    requestedRoles: ['org_staff'],
  })
  assert.deepEqual(result, { ok: false, reason: 'no_org_admin' })
})

test('denies platform_admin grant without platform_admin caller', () => {
  const result = validateMembershipChange({
    callerOrgRole: 'org_admin',
    callerGlobalRoles: ['org_admin'],
    requestedRoles: ['platform_admin'],
  })
  assert.deepEqual(result, { ok: false, reason: 'platform_admin_required' })
})

test('allows org_admin to grant org_staff within org', () => {
  const result = validateMembershipChange({
    callerOrgRole: 'org_admin',
    callerGlobalRoles: ['org_admin'],
    requestedRoles: ['org_staff'],
  })
  assert.deepEqual(result, { ok: true })
})

test('allows platform_admin to grant platform_admin', () => {
  const result = validateMembershipChange({
    callerOrgRole: 'platform_admin',
    callerGlobalRoles: ['platform_admin'],
    requestedRoles: ['platform_admin'],
  })
  assert.deepEqual(result, { ok: true })
})

test('rejects when no roles provided', () => {
  const result = validateMembershipChange({
    callerOrgRole: 'org_admin',
    callerGlobalRoles: ['org_admin'],
    requestedRoles: [],
  })
  assert.deepEqual(result, { ok: false, reason: 'no_roles_provided' })
})
