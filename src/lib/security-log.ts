type SecurityEvent = {
  action: string
  route: string
  userId?: string | null
  orgId?: string | null
  roles?: string[]
  result: 'allow' | 'deny'
  reason?: string
  resourceType?: string
  resourceId?: string
  timestamp?: string
}

/**
 * Lightweight structured security log. Emits JSON to stdout for ingestion.
 */
export function logSecurityEvent(event: SecurityEvent) {
  const payload = {
    timestamp: event.timestamp ?? new Date().toISOString(),
    action: event.action,
    route: event.route,
    user_id: event.userId ?? null,
    org_id: event.orgId ?? null,
    roles: event.roles ?? [],
    result: event.result,
    reason: event.reason ?? null,
    resource_type: event.resourceType ?? null,
    resource_id: event.resourceId ?? null,
  }
  console.log(JSON.stringify({ security_event: payload }))
}
