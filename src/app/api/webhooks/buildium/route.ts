import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { createRequestLogger } from '@/lib/logging'
import { verifyWebhookSignature } from '@/lib/webhooks'

export async function POST(request: NextRequest) {
  const reqLogger = createRequestLogger(request, 'buildium-webhook')
  try {
    // Read raw body for signature verification
    const signature = request.headers.get('x-buildium-signature')
    const rawBody = await request.text()
    const isValid = verifyWebhookSignature(rawBody, signature)
    if (!isValid) {
      reqLogger.warn({ signaturePresent: !!signature }, 'Invalid or missing webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Parse webhook payload
    let payload
    try {
      payload = JSON.parse(rawBody)
    } catch (parseError) {
      reqLogger.error({ error: parseError }, 'Failed to parse webhook payload')
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      )
    }

    // Store webhook event in database for processing
    const { error: storeError } = await supabase
      .from('buildium_webhook_events')
      .insert({
        event_id: payload.Events?.[0]?.Id || 'unknown',
        event_type: payload.Events?.[0]?.EventType || 'unknown',
        event_data: payload,
        processed: false
      })

    if (storeError) {
      reqLogger.error({ error: storeError }, 'Failed to store webhook event')
      // Don't fail the webhook - just log the error
    }

    // Forward to Edge Function for processing
    try {
      const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/buildium-webhook`

      // Propagate W3C trace context for distributed tracing
      const traceparent = request.headers.get('traceparent')
      const tracestate = request.headers.get('tracestate')

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
      }
      if (signature) headers['x-buildium-signature'] = signature
      if (traceparent) headers['traceparent'] = traceparent
      if (tracestate) headers['tracestate'] = tracestate

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorText = await response.text()
        reqLogger.error({ 
          status: response.status, 
          error: errorText 
        }, 'Edge function webhook processing failed')
      } else {
        const result = await response.json()
        reqLogger.info({ result }, 'Webhook processed successfully by Edge Function')
      }

    } catch (edgeFunctionError) {
      reqLogger.error({ 
        error: edgeFunctionError 
      }, 'Failed to forward webhook to Edge Function')
    }

    // Always return success to Buildium
    return NextResponse.json(
      { success: true, message: 'Webhook received and queued for processing' },
      { status: 200 }
    )

  } catch (error) {
    reqLogger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error processing webhook')
    
    // Still return success to avoid Buildium retries
    return NextResponse.json(
      { success: true, message: 'Webhook received' },
      { status: 200 }
    )
  }
}
