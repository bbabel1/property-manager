import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'

const guardMock = vi.fn()
vi.mock('@/lib/buildium-route-guard', () => ({
  getBuildiumOrgIdOr403: (...args: any[]) => guardMock(...args),
}))

const rateLimitMock = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: any[]) => rateLimitMock(...args),
}))

const requireAuthMock = vi.fn().mockResolvedValue({ supabase: {}, user: { id: 'user-1' } })
const requireRoleMock = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/auth/guards', () => ({
  requireAuth: (...args: any[]) => requireAuthMock(...args),
  requireRole: (...args: any[]) => requireRoleMock(...args),
}))

const requireOrgMemberMock = vi.fn().mockResolvedValue({ orgId: 'org-1' })
vi.mock('@/lib/auth/org-guards', () => ({
  requireOrgMember: (...args: any[]) => requireOrgMemberMock(...args),
}))

const listFromBuildiumMock = vi.fn()
vi.mock('@/lib/unit-service', () => ({
  __esModule: true,
  default: {
    listFromBuildium: (...args: any[]) => listFromBuildiumMock(...args),
  },
}))

const invokeMock = vi.fn()
vi.mock('@/lib/db', () => ({
  supabaseAdmin: {
    functions: {
      invoke: (...args: any[]) => invokeMock(...args),
    },
  },
}))

describe('Buildium route guards', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    guardMock.mockReset()
    rateLimitMock.mockReset()
    requireAuthMock.mockReset()
    requireRoleMock.mockReset()
    requireOrgMemberMock.mockReset()
    listFromBuildiumMock.mockReset()
    invokeMock.mockReset()

    rateLimitMock.mockResolvedValue({ success: true })
    requireAuthMock.mockResolvedValue({ supabase: {}, user: { id: 'user-1' } })
    requireRoleMock.mockResolvedValue(undefined)
    requireOrgMemberMock.mockResolvedValue({ orgId: 'org-1' })
  })

  it('short-circuits units sync when Buildium is disabled', async () => {
    guardMock.mockResolvedValue({
      response: NextResponse.json({ error: 'disabled' }, { status: 403 }),
    })
    const route = await import('@/app/api/units/sync/from-buildium/route')

    const res = await route.POST(
      new Request('http://localhost/api/units/sync/from-buildium', {
        method: 'POST',
        body: JSON.stringify({}),
      }) as any,
    )

    expect(res.status).toBe(403)
    expect(listFromBuildiumMock).not.toHaveBeenCalled()
    expect(requireOrgMemberMock).not.toHaveBeenCalled()
  })

  it('invokes units sync when Buildium is enabled', async () => {
    guardMock.mockResolvedValue({ orgId: 'org-1' })
    listFromBuildiumMock.mockResolvedValueOnce([])
    const route = await import('@/app/api/units/sync/from-buildium/route')

    const res = await route.POST(
      new Request('http://localhost/api/units/sync/from-buildium', {
        method: 'POST',
        body: JSON.stringify({ limit: 1 }),
      }) as any,
    )

    expect(res.status).toBe(200)
    expect(listFromBuildiumMock).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: 'org-1' }),
    )
    expect(requireOrgMemberMock).toHaveBeenCalled()
  })

  it('short-circuits work order sync-from when Buildium is disabled', async () => {
    guardMock.mockResolvedValue({
      response: NextResponse.json({ error: 'disabled' }, { status: 403 }),
    })
    const route = await import('@/app/api/work-orders/sync/from-buildium/route')

    const res = await route.POST(
      new Request('http://localhost/api/work-orders/sync/from-buildium', {
        method: 'POST',
        body: JSON.stringify({}),
      }) as any,
    )

    expect(res.status).toBe(403)
    expect(invokeMock).not.toHaveBeenCalled()
    expect(requireRoleMock).toHaveBeenCalledWith('platform_admin')
  })

  it('invokes work order sync-from when Buildium is enabled', async () => {
    guardMock.mockResolvedValue({ orgId: 'org-1' })
    invokeMock.mockResolvedValue({
      data: { success: true, synced: 2, updated: 1 },
      error: null,
    })
    const route = await import('@/app/api/work-orders/sync/from-buildium/route')

    const res = await route.POST(
      new Request('http://localhost/api/work-orders/sync/from-buildium', {
        method: 'POST',
        body: JSON.stringify({}),
      }) as any,
    )

    expect(res.status).toBe(200)
    expect(invokeMock).toHaveBeenCalled()
  })

  it('short-circuits work order sync-to when Buildium is disabled', async () => {
    guardMock.mockResolvedValue({
      response: NextResponse.json({ error: 'disabled' }, { status: 403 }),
    })
    const route = await import('@/app/api/work-orders/sync/to-buildium/route')

    const res = await route.POST(
      new Request('http://localhost/api/work-orders/sync/to-buildium', {
        method: 'POST',
        body: JSON.stringify({ localId: 'local-1' }),
      }) as any,
    )

    expect(res.status).toBe(403)
    expect(invokeMock).not.toHaveBeenCalled()
  })

  it('invokes work order sync-to when Buildium is enabled', async () => {
    guardMock.mockResolvedValue({ orgId: 'org-1' })
    invokeMock.mockResolvedValue({
      data: { success: true, data: { Id: 123 } },
      error: null,
    })
    const route = await import('@/app/api/work-orders/sync/to-buildium/route')

    const res = await route.POST(
      new Request('http://localhost/api/work-orders/sync/to-buildium', {
        method: 'POST',
        body: JSON.stringify({ localId: 'local-1' }),
      }) as any,
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.buildiumId).toBe(123)
    expect(invokeMock).toHaveBeenCalled()
  })
})
