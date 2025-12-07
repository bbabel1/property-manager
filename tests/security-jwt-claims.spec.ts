import { test } from 'node:test'
import assert from 'node:assert/strict'

import { jwtCustomClaims } from './utils/jwtCustomClaimsMock'

test('jwt claims include org_roles map and preferred_org_id', () => {
  const claims = jwtCustomClaims({
    memberships: [
      { org_id: 'org-1', role: 'org_admin' },
      { org_id: 'org-2', role: 'org_staff' },
    ],
    membershipRoles: [
      { org_id: 'org-1', role: 'org_manager' },
      { org_id: 'org-2', role: 'org_staff' },
    ],
  })

  assert.ok(claims.org_roles)
  assert.deepEqual(claims.org_roles['org-1'].sort(), ['org_manager'].sort())
  assert.deepEqual(claims.org_roles['org-2'], ['org_staff'])
  assert.ok(claims.preferred_org_id)
  assert.equal(claims.org_ids.length, 2)
})
