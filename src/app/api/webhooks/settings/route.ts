import { NextResponse } from 'next/server'
import { requireSupabaseAdmin } from '@/lib/supabase-client'

export async function GET() {
  try {
    const admin = requireSupabaseAdmin('webhook settings GET')
    const { data, error } = await admin
      .from('webhook_event_flags')
      .select('event_type, enabled')
      .order('event_type')
    if (error) throw error
    return NextResponse.json({ events: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to load webhook settings' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
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
    return NextResponse.json({ error: err?.message || 'Failed to update webhook setting' }, { status: 500 })
  }
}
