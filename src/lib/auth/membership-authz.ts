import type { AppRole } from '@/lib/auth/roles'

type ValidationResult =
  | { ok: true }
  | { ok: false; reason: 'no_org_admin' | 'platform_admin_required' | 'no_roles_provided' }

/**
 * Centralizes guardrails for membership changes so we can unit-test the rules:
 * - Caller must be at least org_admin in the target org
 * - Only platform_admin can grant platform_admin
 * - At least one role must be provided
 */
export function validateMembershipChange(params: {
  callerOrgRole: AppRole | null | undefined
  callerGlobalRoles: AppRole[]
  requestedRoles: AppRole[]
}): ValidationResult {
  const callerOrgRole = params.callerOrgRole ?? null
  const callerGlobalRoles = params.callerGlobalRoles ?? []
  const requested = params.requestedRoles ?? []

  if (!requested.length) return { ok: false, reason: 'no_roles_provided' }

  if (!callerOrgRole || !['org_admin', 'platform_admin'].includes(callerOrgRole)) {
    return { ok: false, reason: 'no_org_admin' }
  }

  if (
    requested.includes('platform_admin') &&
    !callerGlobalRoles.includes('platform_admin')
  ) {
    return { ok: false, reason: 'platform_admin_required' }
  }

  return { ok: true }
}
