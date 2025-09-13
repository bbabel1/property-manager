import crypto from 'crypto';

/**
 * Verify webhook signature to ensure requests come from Buildium
 * @param payload - The raw request body
 * @param signature - The signature from x-buildium-signature header
 * @returns boolean - True if signature is valid
 */
export function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  if (!signature) {
    console.warn('No webhook signature provided');
    return false;
  }
  
  if (!process.env.BUILDIUM_WEBHOOK_SECRET) {
    console.error('BUILDIUM_WEBHOOK_SECRET environment variable not set');
    return false;
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', process.env.BUILDIUM_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Parse and validate webhook event data
 * @param body - The webhook request body
 * @returns Parsed event data or null if invalid
 */
export function parseWebhookEvent(body: string): any {
  try {
    const event = JSON.parse(body);
    
    // Validate required fields
    if (!event.eventId || !event.eventType || !event.timestamp) {
      console.error('Invalid webhook event structure:', event);
      return null;
    }
    
    return event;
  } catch (error) {
    console.error('Failed to parse webhook event:', error);
    return null;
  }
}

/**
 * Process webhook event based on event type
 * @param event - The parsed webhook event
 */
export async function processWebhookEvent(event: any): Promise<void> {
  const { eventType, data, eventId } = event;
  
  console.log(`Processing webhook event: ${eventType} (ID: ${eventId})`);
  
  try {
    switch (eventType) {
      case 'bank_account.updated':
        await handleBankAccountUpdate(data);
        break;
      case 'lease.payment_received':
        await handleLeasePaymentReceived(data);
        break;
      case 'task.status_changed':
        await handleTaskStatusChange(data);
        break;
      case 'property.updated':
        await handlePropertyUpdate(data);
        break;
      case 'tenant.moved_in':
        await handleTenantMovedIn(data);
        break;
      case 'bill.created':
        await handleBillCreated(data);
        break;
      case 'work_order.assigned':
        await handleWorkOrderAssigned(data);
        break;
      default:
        console.log(`Unhandled webhook event type: ${eventType}`);
    }
  } catch (error) {
    console.error(`Error processing webhook event ${eventType}:`, error);
    throw error;
  }
}

// Event handler functions - implement based on your business logic
async function handleBankAccountUpdate(data: any): Promise<void> {
  console.log('Bank account updated:', data);
  // Implement your bank account update logic
  // e.g., sync with internal database, send notifications, etc.
}

async function handleLeasePaymentReceived(data: any): Promise<void> {
  console.log('Lease payment received:', data);
  // Implement your payment processing logic
  // e.g., update lease balance, send receipt, etc.
}

async function handleTaskStatusChange(data: any): Promise<void> {
  console.log('Task status changed:', data);
  // Implement your task update logic
  // e.g., update internal task system, send notifications, etc.
}

async function handlePropertyUpdate(data: any): Promise<void> {
  console.log('Property updated:', data);
  // Implement your property update logic
  // e.g., sync property data, update listings, etc.
}

async function handleTenantMovedIn(data: any): Promise<void> {
  console.log('Tenant moved in:', data);
  // Implement your tenant move-in logic
  // e.g., update occupancy status, send welcome package, etc.
}

async function handleBillCreated(data: any): Promise<void> {
  console.log('Bill created:', data);
  // Implement your bill creation logic
  // e.g., sync with accounting system, send notifications, etc.
}

async function handleWorkOrderAssigned(data: any): Promise<void> {
  console.log('Work order assigned:', data);
  // Implement your work order assignment logic
  // e.g., notify assigned vendor, update internal system, etc.
}

/**
 * Generate webhook signature for testing purposes
 * @param payload - The payload to sign
 * @param secret - The webhook secret
 * @returns The generated signature
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Validate webhook URL format
 * @param url - The webhook URL to validate
 * @returns boolean - True if URL is valid
 */
export function validateWebhookUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'https:' && parsedUrl.hostname.length > 0;
  } catch {
    return false;
  }
}