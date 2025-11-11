import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const TABLE = 'property_notes'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimit = await checkRateLimit(request)
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests', retryAfter: rateLimit.retryAfter }, { status: 429 })
    }

    await requireUser(request)
    const { id: propertyId } = await params

    const { searchParams } = new URL(request.url)
    const limitRaw = Number(searchParams.get('limit') ?? '50')
    const offsetRaw = Number(searchParams.get('offset') ?? '0')
    const limit = Number.isNaN(limitRaw) ? 50 : Math.min(Math.max(limitRaw, 1), 100)
    const offset = Number.isNaN(offsetRaw) ? 0 : Math.max(offsetRaw, 0)
    const start = offset
    const end = offset + (limit > 0 ? limit - 1 : 0)

    const client = supabaseAdmin as any
    const { data, error } = await client
      .from(TABLE)
      .select('*')
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })
      .range(start, end)
    if (error) {
      logger.error({ error, propertyId }, 'Failed to load property notes')
      return NextResponse.json({ error: 'Failed to load property notes' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data ?? [], count: data?.length ?? 0 })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    logger.error({ error }, 'Unexpected error fetching property notes')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rateLimit = await checkRateLimit(request)
    if (!rateLimit.success) {
      return NextResponse.json({ error: 'Too many requests', retryAfter: rateLimit.retryAfter }, { status: 429 })
    }

    const user = await requireUser(request)
    const { id: propertyId } = await params

    const payload = await request.json()
    const subject = typeof payload?.subject === 'string' ? payload.subject.trim() : null
    const body = typeof payload?.body === 'string' ? payload.body.trim() : null
    const isPrivate = Boolean(payload?.is_private ?? payload?.isPrivate ?? false)

    if (!subject) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 })
    }
    if (!body) {
      return NextResponse.json({ error: 'Body is required' }, { status: 400 })
    }

    const client = supabaseAdmin as any
    const { data, error } = await client
      .insert({
        property_id: propertyId,
        subject,
        body,
        is_private: isPrivate,
        created_by: user.id,
        created_by_name: user.email ?? user.user_metadata?.full_name ?? 'Unknown',
      })
      .select()
      .single()

    if (error) {
      logger.error({ error, propertyId, userId: user.id }, 'Failed to create property note')
      return NextResponse.json({ error: 'Failed to create property note' }, { status: 500 })
    }

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    logger.error({ error }, 'Unexpected error creating property note')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
