import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { supabase, supabaseAdmin } from '@/lib/db'

function computeHmac(raw: string, secret: string) {
  const buf = createHmac('sha256', secret).update(raw).digest()
  return {
    hex: buf.toString('hex'),
    base64: buf.toString('base64'),
  }
}

function verifySignature(req: NextRequest, raw: string): { ok: boolean; reason?: string } {
  // Try multiple possible header names for Buildium signature
  const sig = 
    req.headers.get('x-buildium-signature') || 
    req.headers.get('buildium-webhook-signature') ||
    req.headers.get('x-buildium-webhook-signature') ||
    ''
  
  // Try multiple possible header names for timestamp
  const timestamp = 
    req.headers.get('buildium-webhook-timestamp') ||
    req.headers.get('x-buildium-timestamp') ||
    req.headers.get('x-buildium-webhook-timestamp') ||
    ''
  
  const secret = process.env.BUILDIUM_WEBHOOK_SECRET || ''

  // In local/dev, allow processing without a secret to simplify testing.
  if (!secret) {
    console.warn('[buildium-webhook] BUILDIUM_WEBHOOK_SECRET is not set; skipping signature verification')
    return { ok: true }
  }

  if (!sig) {
    // Log in development to help debug
    if (process.env.NODE_ENV === 'development') {
      console.warn('[buildium-webhook] No signature header found. Checked headers:', {
        'x-buildium-signature': req.headers.get('x-buildium-signature'),
        'buildium-webhook-signature': req.headers.get('buildium-webhook-signature'),
        'x-buildium-webhook-signature': req.headers.get('x-buildium-webhook-signature'),
      })
    }
    return { ok: false, reason: 'missing-signature' }
  }

  try {
    // Try both the secret as-is and base64 decoded (Buildium secret might be base64)
    let secretToUse = secret
    try {
      // If secret looks like base64, try decoding it
      if (secret.includes('=') && secret.length % 4 === 0) {
        const decoded = Buffer.from(secret, 'base64').toString('utf-8')
        if (decoded && decoded.length > 0) {
          secretToUse = decoded
        }
      }
    } catch {
      // If decoding fails, use original secret
    }
    
    // Buildium signs: timestamp + '.' + raw body, then HMAC-SHA256, then base64 encode
    // If timestamp is present, use it; otherwise sign just the raw body
    const payloadToSign = timestamp ? `${timestamp}.${raw}` : raw
    
    // Try with both original secret and decoded secret
    const { hex, base64 } = computeHmac(payloadToSign, secretToUse)
    const { hex: hexOriginal, base64: base64Original } = secretToUse !== secret ? computeHmac(payloadToSign, secret) : { hex: '', base64: '' }
    
    // Buildium signature is base64-encoded HMAC
    // The signature we receive is already base64, so we need to compare base64 to base64
    // Also try converting hex to base64 for comparison
    const expectedBase64FromHex = Buffer.from(hex, 'hex').toString('base64')
    const expectedBase64FromHexOriginal = hexOriginal ? Buffer.from(hexOriginal, 'hex').toString('base64') : ''
    
    // Check if Buildium sends signature with a prefix (e.g., "sha256=...")
    const sigWithoutPrefix = sig.replace(/^(sha256=|sha1=)/i, '')
    
    // Try exact match with base64 (most likely format)
    if (sig === base64 || sig === expectedBase64FromHex) {
      return { ok: true }
    }
    
    // Try without prefix
    if (sigWithoutPrefix === base64 || sigWithoutPrefix === expectedBase64FromHex) {
      return { ok: true }
    }
    
    // Try with original secret if we tried decoded
    if (hexOriginal && (sig === base64Original || sig === expectedBase64FromHexOriginal)) {
      return { ok: true }
    }
    if (hexOriginal && (sigWithoutPrefix === base64Original || sigWithoutPrefix === expectedBase64FromHexOriginal)) {
      return { ok: true }
    }
    
    // Also try hex format (unlikely but possible)
    if (sig === hex || sigWithoutPrefix === hex) {
      return { ok: true }
    }
    if (hexOriginal && (sig === hexOriginal || sigWithoutPrefix === hexOriginal)) {
      return { ok: true }
    }
    
    // Log for debugging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.error('[buildium-webhook] Signature verification failed:', {
        reason: 'signature-mismatch',
        receivedLength: sig.length,
        hasTimestamp: !!timestamp,
        bodyLength: raw.length,
      })
    }
    
    return { ok: false, reason: 'invalid-signature' }
  } catch (e) {
    console.error('[buildium-webhook] HMAC error:', e)
    return { ok: false, reason: 'hmac-error' }
  }
}

export async function POST(req: NextRequest) {
  const admin = supabaseAdmin || supabase
  const raw = await req.text()
  
  // Log webhook receipt (in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('[buildium-webhook] Received webhook, body length:', raw.length)
  }
  
  let body: any = {}
  try {
    body = JSON.parse(raw || '{}')
  } catch (e) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const sigCheck = verifySignature(req, raw)
  if (!sigCheck.ok) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[buildium-webhook] Signature check failed:', sigCheck.reason)
    }
    return NextResponse.json({ error: 'Invalid signature', reason: sigCheck.reason }, { status: 401 })
  }

  // Buildium sends events in different formats:
  // 1. { Events: [...] } - array of events
  // 2. { EventName: "...", ... } - single event object (current format)
  // 3. { Event: {...} } - wrapped single event
  let events: any[] = []
  
  if (Array.isArray(body?.Events)) {
    events = body.Events
  } else if (body?.Event) {
    events = [body.Event]
  } else if (body?.EventName || body?.Id || body?.eventId) {
    // Single event object (Buildium's current format)
    events = [body]
  }

  if (!events.length) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[buildium-webhook] No events found in payload. Body structure:', {
        hasEvents: !!body?.Events,
        hasEvent: !!body?.Event,
        hasEventName: !!body?.EventName,
        hasId: !!body?.Id,
        bodyKeys: Object.keys(body || {}),
        bodyPreview: JSON.stringify(body).substring(0, 200),
      })
    }
    return NextResponse.json({ error: 'No webhook events found in payload' }, { status: 400 })
  }

  const signatureHeader = req.headers.get('x-buildium-signature') || ''
  const results: { eventId: string | number | null; status: 'processed' | 'duplicate' | 'error'; error?: string }[] = []

  try {
    for (const event of events) {
      // Buildium event IDs can be in different fields
      const eventId = event?.Id ?? event?.EventId ?? event?.eventId ?? event?.id ?? event?.TransactionId ?? event?.LeaseId ?? null
      // Buildium event types can be EventType or EventName
      const type = event?.EventType ?? event?.EventName ?? body?.type ?? body?.eventType ?? body?.EventName ?? 'unknown'

      // Idempotent ingest per event
      if (eventId != null) {
        const { data: existing } = await admin
          .from('buildium_webhook_events')
          .select('id')
          .eq('event_id', eventId)
          .maybeSingle()
        if (existing?.id) {
          results.push({ eventId, status: 'duplicate' })
          continue
        }
      }

      await admin.from('buildium_webhook_events').insert({
        event_id: eventId,
        event_type: type,
        signature: signatureHeader,
        payload: event,
        status: 'received',
      })

      // Placeholder for downstream processing; currently mark as processed
      await admin
        .from('buildium_webhook_events')
        .update({ status: 'processed', processed_at: new Date().toISOString() })
        .eq('event_id', eventId)

      results.push({ eventId, status: 'processed' })
    }

    const processed = results.filter((r) => r.status === 'processed').length
    const duplicates = results.filter((r) => r.status === 'duplicate').length
    const errors = results.filter((r) => r.status === 'error')

    return NextResponse.json({
      ok: true,
      received: events.length,
      processed,
      duplicates,
      errors,
    })
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : 'Unknown error'
    const idsForError = events
      .map((ev) => ev?.Id ?? ev?.EventId ?? ev?.eventId ?? ev?.id ?? null)
      .filter((v) => v != null)
    if (idsForError.length > 0) {
      await admin
        .from('buildium_webhook_events')
        .update({ status: 'error', error: errorMessage, processed_at: new Date().toISOString() })
        .in('event_id', idsForError)
    }
    return NextResponse.json({ error: 'Internal error', detail: errorMessage }, { status: 500 })
  }
}
