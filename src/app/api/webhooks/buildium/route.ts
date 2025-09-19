import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabase, supabaseAdmin } from '@/lib/db'

function verifySignature(req: NextRequest, raw: string): boolean {
  const sig = req.headers.get('x-buildium-signature') || ''
  const secret = process.env.BUILDIUM_WEBHOOK_SECRET || ''
  if (!secret) return false
  // Simple HMAC placeholder (you can replace with actual Buildium signing algorithm when documented)
  try {
    const h = crypto.createHmac('sha256', secret).update(raw).digest('hex')
    return sig === h
  } catch {
    return false
  }
}

type BuildiumWebhookPayload = {
  eventId?: string | number
  id?: string | number
  type?: string
  eventType?: string
  [key: string]: unknown
}

export async function POST(req: NextRequest) {
  const admin = supabaseAdmin || supabase
  const raw = await req.text()
  const ok = verifySignature(req, raw)
  if (!ok) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  const body = JSON.parse(raw || '{}') as BuildiumWebhookPayload
  const eventId = (body.eventId ?? body.id) ?? null
  const type = (body.type ?? body.eventType) ?? 'unknown'
  try {
    // Idempotent ingest
    const { data: existing } = await admin.from('buildium_webhook_events').select('id').eq('event_id', eventId).maybeSingle()
    if (existing?.id) return NextResponse.json({ ok: true, duplicate: true })
    await admin.from('buildium_webhook_events').insert({ event_id: eventId, event_type: type, signature: req.headers.get('x-buildium-signature') || '', payload: body, status: 'received' })

    // Minimal handlers (stubs): upsert by buildium_*_id
    // TODO: Map Lease.*, LeaseTransaction.*, RecurringTransaction.*, Rent.* with your existing mapping helpers

    await admin.from('buildium_webhook_events').update({ status: 'processed', processed_at: new Date().toISOString() }).eq('event_id', eventId)
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'error'
    await admin
      .from('buildium_webhook_events')
      .update({ status: 'error', error: message, processed_at: new Date().toISOString() })
      .eq('event_id', eventId)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

