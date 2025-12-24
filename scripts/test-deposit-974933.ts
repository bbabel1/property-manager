/**
 * Test script to replay deposit webhook TransactionId 974933
 */

// Load environment variables BEFORE any imports
import { config } from 'dotenv';
import { resolve } from 'path';

// Try loading .env.local first, then .env
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const WEBHOOK_EVENT = {
  AccountId: 514306,
  EventName: 'BankAccount.Transaction.Created',
  BankAccountId: 10407,
  EventDateTime: '2025-12-21T05:17:20.6759894Z',
  TransactionId: 974933,
  TransactionType: 'Deposit',
};

// Import the processing function from the test script
import { processBankAccountTransactionEvent } from './test-buildium-webhook-direct.js';

async function testWebhook() {
  console.log('='.repeat(60));
  console.log('Testing Deposit Webhook Event 974933');
  console.log('='.repeat(60));
  console.log('\nEvent Payload:');
  console.log(JSON.stringify(WEBHOOK_EVENT, null, 2));

  // Dynamic import to ensure env vars are loaded first
  const { supabaseAdmin } = await import('../src/lib/db.js');

  try {
    const result = await processBankAccountTransactionEvent(
      supabaseAdmin,
      WEBHOOK_EVENT as any,
    );

    console.log('\n' + '='.repeat(60));
    console.log('Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('='.repeat(60));

    if (result.success) {
      console.log('\n✅ Webhook event processed successfully!');
    } else {
      console.log('\n❌ Webhook event processing failed!');
      console.log(`Error: ${result.error}`);
    }
  } catch (error) {
    console.error('\n❌ Error processing webhook:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testWebhook()
  .then(() => {
    console.log('\n✅ Test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
