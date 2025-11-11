/**
 * Test Resend Email Configuration
 *
 * Validates that Resend is properly configured and can send emails.
 * Usage: npx tsx scripts/test-resend-config.ts
 */

import { config } from 'dotenv';
import { Resend } from 'resend';

config({ path: '.env.local' });

async function testResendConfiguration() {
  console.log('🔍 Testing Resend Configuration...\n');

  // 1. Check environment variables
  console.log('Step 1: Checking environment variables...');
  const requiredVars = {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS,
    EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME,
  };

  let hasErrors = false;
  for (const [key, value] of Object.entries(requiredVars)) {
    if (!value) {
      console.log(`  ❌ ${key} - NOT SET`);
      hasErrors = true;
    } else {
      console.log(`  ✅ ${key} - Set`);
    }
  }

  if (hasErrors) {
    console.log('\n⚠️  Missing required environment variables!');
    console.log('Please add them to your .env.local file.\n');
    process.exit(1);
  }

  // 2. Initialize Resend client
  console.log('\nStep 2: Initializing Resend client...');
  const resend = new Resend(process.env.RESEND_API_KEY);
  console.log('  ✅ Resend client initialized');

  // 3. Send test email
  console.log('\nStep 3: Sending test email...');
  console.log(`  From: ${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`);

  // Prompt for test recipient
  console.log(
    '\n⚠️  NOTE: In development, use a verified email address from your Resend dashboard.',
  );
  console.log('Enter the test recipient email address:');

  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Recipient email: ', async (recipientEmail: string) => {
    try {
      if (!recipientEmail || !recipientEmail.includes('@')) {
        console.log('\n❌ Invalid email address');
        rl.close();
        process.exit(1);
      }

      const { data, error } = await resend.emails.send({
        from: `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM_ADDRESS}>`,
        to: recipientEmail,
        subject: 'Resend Configuration Test - Property Manager',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #0f172a;">Resend Test Email</h1>
            <p>Congratulations! Your Resend email service is properly configured.</p>
            <div style="background: #f0f9ff; border: 2px solid #3b82f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Configuration Details:</strong></p>
              <ul style="margin: 8px 0; padding-left: 20px;">
                <li>From: ${process.env.EMAIL_FROM_NAME}</li>
                <li>Address: ${process.env.EMAIL_FROM_ADDRESS}</li>
                <li>Company: ${process.env.COMPANY_NAME || 'Not configured'}</li>
              </ul>
            </div>
            <p>You're ready to send monthly statements!</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 12px; color: #64748b;">
              This is an automated test email from your Property Manager application.
            </p>
          </div>
        `,
        text: `
Resend Configuration Test - Property Manager

Congratulations! Your Resend email service is properly configured.

Configuration Details:
- From: ${process.env.EMAIL_FROM_NAME}
- Address: ${process.env.EMAIL_FROM_ADDRESS}
- Company: ${process.env.COMPANY_NAME || 'Not configured'}

You're ready to send monthly statements!
        `.trim(),
      });

      if (error) {
        console.log('\n❌ Failed to send test email:');
        console.log(`   Error: ${error.message || JSON.stringify(error)}`);
        rl.close();
        process.exit(1);
      }

      console.log('\n✅ Test email sent successfully!');
      console.log(`   Message ID: ${data?.id}`);
      console.log(`\n📬 Check your inbox at: ${recipientEmail}`);
      console.log("\n💡 If you don't see it:");
      console.log('   1. Check your spam folder');
      console.log('   2. Wait a few minutes for delivery');
      console.log('   3. Verify the email address in Resend dashboard (development mode)');
      console.log('   4. Check Resend dashboard for delivery logs\n');

      rl.close();
    } catch (error) {
      console.log('\n❌ Unexpected error:');
      console.error(error);
      rl.close();
      process.exit(1);
    }
  });
}

testResendConfiguration().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
