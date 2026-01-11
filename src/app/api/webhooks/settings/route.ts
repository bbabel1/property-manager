import { NextResponse } from 'next/server'
import { requireSupabaseAdmin } from '@/lib/supabase-client'
import { requireAuth } from '@/lib/auth/guards'

const SHARED_SECRET = process.env.WEBHOOK_SETTINGS_ADMIN_SECRET || ''

async function authorize(req: Request) {
  const headerSecret = req.headers.get('x-webhook-admin-secret')
  if (SHARED_SECRET && headerSecret && headerSecret === SHARED_SECRET) {
    return true
  }

  const { roles } = await requireAuth()
  if (!roles.includes('platform_admin')) {
    throw new Error('FORBIDDEN')
  }
  return true
}

export async function GET(req: Request) {
  try {
    await authorize(req)

    const admin = requireSupabaseAdmin('webhook settings GET')
    const { data, error } = await admin
      .from('webhook_event_flags')
      .select('event_type, enabled')
      .order('event_type')
    if (error) {
      // If table is missing or schema cache not yet refreshed, return empty list gracefully
      const msg = error?.message || ''
      if (msg.includes('webhook_event_flags') || msg.toLowerCase().includes('schema')) {
        return NextResponse.json({ events: [] })
      }
      throw error
    }
    return NextResponse.json({ events: data || [] })
  } catch (err: any) {
    const msg = err?.message || ''
    if (msg === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: msg || 'Failed to load webhook settings' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    await authorize(req)

    const admin = requireSupabaseAdmin('webhook settings POST')
    const body = await req.json().catch(() => ({}))
    const eventType = body?.event_type
    const enabled = body?.enabled
    if (!eventType || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'event_type and enabled are required' }, { status: 400 })
    }
    const now = new Date().toISOString()
    const { data, error } = await admin
      .from('webhook_event_flags')
      .upsert({ event_type: eventType, enabled, updated_at: now }, { onConflict: 'event_type' })
      .select('event_type, enabled')
      .single()
    if (error) throw error
    return NextResponse.json({ event: data })
  } catch (err: any) {
    const msg = err?.message || ''
    if (msg === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (msg === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: msg || 'Failed to update webhook setting' }, { status: 500 })
  }
}
