import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/db'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature (if provided)
    const signature = request.headers.get('x-buildium-signature')
    const webhookSecret = process.env.BUILDIUM_WEBHOOK_SECRET
    
    if (webhookSecret && signature) {
      // TODO: Implement signature verification
      // For now, we'll log the signature for debugging
      logger.info({ signature }, 'Webhook signature received');
    }

    // Parse webhook payload
    let payload;
    try {
      payload = await request.json()
    } catch (parseError) {
      logger.error({ error: parseError }, 'Failed to parse webhook payload');
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
      logger.error({ error: storeError }, 'Failed to store webhook event');
      // Don't fail the webhook - just log the error
    }

    // Forward to Edge Function for processing
    try {
      const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/buildium-webhook`
      
      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'x-buildium-signature': signature || ''
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error({ 
          status: response.status, 
          error: errorText 
        }, 'Edge function webhook processing failed');
      } else {
        const result = await response.json()
        logger.info({ result }, 'Webhook processed successfully by Edge Function');
      }

    } catch (edgeFunctionError) {
      logger.error({ 
        error: edgeFunctionError 
      }, 'Failed to forward webhook to Edge Function');
    }

    // Always return success to Buildium
    return NextResponse.json(
      { success: true, message: 'Webhook received and queued for processing' },
      { status: 200 }
    )

  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Error processing webhook');
    
    // Still return success to avoid Buildium retries
    return NextResponse.json(
      { success: true, message: 'Webhook received' },
      { status: 200 }
    )
  }
}
