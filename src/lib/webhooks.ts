import crypto from 'crypto'

export function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  if (!signature) return false
  const secret = process.env.BUILDIUM_WEBHOOK_SECRET
  if (!secret) return false
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

export function parseWebhookEvent(body: string): Record<string, unknown> | null {
  try {
    const evt = JSON.parse(body) as Record<string, unknown>
    if (!evt?.eventId || !evt?.eventType || !evt?.timestamp) return null
    return evt
  } catch {
    return null
  }
}

export async function processWebhookEvent(event: Record<string, unknown>): Promise<void> {
  const { eventType, data, eventId } = event || {}
  console.log(`Processing webhook event: ${eventType} (ID: ${eventId})`)
  try {
    switch (eventType) {
      case 'bank_account.updated':
        await handleBankAccountUpdate(data); break
      case 'lease.payment_received':
        await handleLeasePaymentReceived(data); break
      case 'task.status_changed':
        await handleTaskStatusChange(data); break
      case 'property.updated':
        await handlePropertyUpdate(data); break
      case 'tenant.moved_in':
        await handleTenantMovedIn(data); break
      case 'bill.created':
        await handleBillCreated(data); break
      case 'work_order.assigned':
        await handleWorkOrderAssigned(data); break
      default:
        console.log(`Unhandled webhook event type: ${eventType}`)
    }
  } catch (err) {
    console.error(`Error processing webhook event ${eventType}:`, err)
    throw err
  }
}

async function handleBankAccountUpdate(data: unknown) { console.log('Bank account updated:', data) }
async function handleLeasePaymentReceived(data: unknown) { console.log('Lease payment received:', data) }
async function handleTaskStatusChange(data: unknown) { console.log('Task status changed:', data) }
async function handlePropertyUpdate(data: unknown) { console.log('Property updated:', data) }
async function handleTenantMovedIn(data: unknown) { console.log('Tenant moved in:', data) }
async function handleBillCreated(data: unknown) { console.log('Bill created:', data) }
async function handleWorkOrderAssigned(data: unknown) { console.log('Work order assigned:', data) }

export function generateWebhookSignature(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

export function validateWebhookUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname.length > 0
  } catch {
    return false
  }
}
