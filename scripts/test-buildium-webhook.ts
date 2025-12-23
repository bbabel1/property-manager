/**
 * Test script to process a Buildium webhook event
 * Simulates what happens when Buildium sends a webhook to the system
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createHmac } from 'crypto'

// Load environment variables BEFORE reading process.env
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

const WEBHOOK_EVENT = {
  AccountId: 514306,
  EventName: 'BankAccount.Transaction.Updated',
  BankAccountId: 10407,
  EventDateTime: '2025-12-21T15:32:42.5088622Z',
  TransactionId: 974934,
  TransactionType: 'Deposit',
}

async function testWebhook() {
  const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:3000/api/webhooks/buildium'
  const webhookSecret = process.env.BUILDIUM_WEBHOOK_SECRET || ''

  const payload = JSON.stringify(WEBHOOK_EVENT)

  // Generate signature if secret is provided
  let signature = ''
  let timestamp = ''
  if (webhookSecret) {
    timestamp = Date.now().toString()
    const payloadToSign = `${timestamp}.${payload}`
    const hmac = createHmac('sha256', webhookSecret).update(payloadToSign).digest('base64')
    signature = hmac
  }

  console.log('Testing Buildium Webhook Event Processing')
  console.log('=' .repeat(60))
  console.log('\nEvent Payload:')
  console.log(JSON.stringify(WEBHOOK_EVENT, null, 2))
  console.log('\n' + '='.repeat(60))

  try {
    const bearer =
      process.env.WEBHOOK_AUTH_BEARER ||
      process.env.WEBHOOK_AUTHORIZATION ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      ''

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Buildium-Webhook-Test/1.0',
    }

    if (bearer) {
      headers['authorization'] = `Bearer ${bearer}`
      headers['apikey'] = bearer
    }

    if (signature) {
      headers['x-buildium-signature'] = signature
      headers['buildium-webhook-timestamp'] = timestamp
    }

    console.log('\nSending POST request to:', webhookUrl)
    console.log('Headers:', JSON.stringify(headers, null, 2))

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: payload,
    })

    const responseText = await response.text()
    let responseJson: any = null
    try {
      responseJson = JSON.parse(responseText)
    } catch {
      // Response is not JSON
    }

    console.log('\n' + '='.repeat(60))
    console.log('Response Status:', response.status, response.statusText)
    console.log('Response Body:')
    if (responseJson) {
      console.log(JSON.stringify(responseJson, null, 2))
    } else {
      console.log(responseText)
    }

    if (response.ok) {
      console.log('\n✓ Webhook processed successfully!')
      if (responseJson?.results) {
        console.log('\nProcessing Results:')
        responseJson.results.forEach((result: any, index: number) => {
          console.log(`  Event ${index + 1}:`, {
            eventId: result.eventId,
            status: result.status,
            error: result.error || 'none',
          })
        })
      }
    } else {
      console.log('\n✗ Webhook processing failed!')
    }

    console.log('\n' + '='.repeat(60))
  } catch (error) {
    console.error('\n✗ Error testing webhook:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Stack:', error.stack)
    }
    process.exit(1)
  }
}

// Run the test
testWebhook()
  .then(() => {
    console.log('\nTest completed.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\nTest failed:', error)
    process.exit(1)
  })
