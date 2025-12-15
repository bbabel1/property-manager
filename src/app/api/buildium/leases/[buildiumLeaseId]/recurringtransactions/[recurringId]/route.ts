import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { BuildiumRecurringTransactionUpdateSchema } from '@/schemas/buildium'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ buildiumLeaseId: string; recurringId: string }> },
) {
  try {
    const rateLimitResult = await checkRateLimit(request)
    if (!rateLimitResult.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    await requireRole('platform_admin')
    const { buildiumLeaseId, recurringId } = await params

    const response = await fetch(`${process.env.BUILDIUM_BASE_URL}/leases/${buildiumLeaseId}/recurring-transactions/${recurringId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      logger.error('Buildium recurring transaction fetch failed')
      return NextResponse.json({ error: 'Failed to fetch Buildium recurring transaction', details: errorData }, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ buildiumLeaseId: string; recurringId: string }> },
) {
  try {
    const rateLimitResult = await checkRateLimit(request)
    if (!rateLimitResult.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    await requireRole('platform_admin')
    const { buildiumLeaseId, recurringId } = await params
    const body = await request.json()
    const validated = sanitizeAndValidate(body, BuildiumRecurringTransactionUpdateSchema)

    const response = await fetch(`${process.env.BUILDIUM_BASE_URL}/leases/${buildiumLeaseId}/recurring-transactions/${recurringId}`, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
      body: JSON.stringify(validated)
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      logger.error('Buildium recurring transaction update failed')
      return NextResponse.json({ error: 'Failed to update Buildium recurring transaction', details: errorData }, { status: response.status })
    }
    const updated = await response.json()
    return NextResponse.json({ success: true, data: updated })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ buildiumLeaseId: string; recurringId: string }> },
) {
  try {
    const rateLimitResult = await checkRateLimit(request)
    if (!rateLimitResult.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    await requireRole('platform_admin')
    const { buildiumLeaseId, recurringId } = await params

    const response = await fetch(`${process.env.BUILDIUM_BASE_URL}/leases/${buildiumLeaseId}/recurring-transactions/${recurringId}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      logger.error('Buildium recurring transaction delete failed')
      return NextResponse.json({ error: 'Failed to delete Buildium recurring transaction', details: errorData }, { status: response.status })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
