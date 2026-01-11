/**
 * Test script to directly test Buildium DELETE endpoint for tenant notes
 * Tests with Buildium note ID 15648 and tenant ID 58807
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const buildiumBaseUrl = process.env.BUILDIUM_BASE_URL || 'https://apisandbox.buildium.com/v1';
const clientId = process.env.BUILDIUM_CLIENT_ID;
const clientSecret = process.env.BUILDIUM_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('❌ Missing Buildium credentials:');
  if (!clientId) console.error('   - BUILDIUM_CLIENT_ID');
  if (!clientSecret) console.error('   - BUILDIUM_CLIENT_SECRET');
  process.exit(1);
}

async function testBuildiumDelete(tenantId: number, noteId: number) {
  console.log('🧪 Testing Buildium DELETE for Tenant Notes');
  console.log('='.repeat(60));
  console.log(`\nTenant ID: ${tenantId}`);
  console.log(`Note ID: ${noteId}`);
  console.log(`Base URL: ${buildiumBaseUrl}\n`);

  const endpoints = [
    `/rentals/tenants/${tenantId}/notes/${noteId}`,
    `/leases/tenants/${tenantId}/notes/${noteId}`,
  ];

  for (let i = 0; i < endpoints.length; i++) {
    const path = endpoints[i];
    const url = `${buildiumBaseUrl}${path}`;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Test ${i + 1}/${endpoints.length}: ${path}`);
    console.log(`Full URL: ${url}`);
    console.log('='.repeat(60));

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Buildium-Client-Id': clientId,
          'X-Buildium-Client-Secret': clientSecret,
        },
      });

      const responseText = await response.text();
      let responseJson: any;
      try {
        responseJson = responseText ? JSON.parse(responseText) : null;
      } catch {
        responseJson = null;
      }

      console.log(`\nStatus: ${response.status} ${response.statusText}`);
      console.log(`OK: ${response.ok}`);

      if (response.ok) {
        console.log('\n✅ SUCCESS! DELETE endpoint works!');
        console.log('Response:', JSON.stringify(responseJson, null, 2));
        return true;
      } else {
        console.log('\n❌ FAILED');
        console.log('Response:', responseJson || responseText);
        
        if (response.status === 404) {
          console.log('\n⚠️  404 Not Found - This endpoint does not exist');
          if (i < endpoints.length - 1) {
            console.log('   Trying next endpoint...');
          } else {
            console.log('   All endpoints returned 404 - DELETE is not supported');
          }
        } else {
          console.log(`\n⚠️  Error: ${response.status}`);
          if (responseJson?.UserMessage) {
            console.log(`   Message: ${responseJson.UserMessage}`);
          }
        }
      }
    } catch (error) {
      console.error('\n❌ Request failed:', error);
      if (error instanceof Error) {
        console.error('   Error message:', error.message);
      }
    }
  }

  return false;
}

// Test with note ID 15648 and tenant ID 58807 (from your logs)
const tenantId = 58807;
const noteId = 15648;

console.log('\n');
testBuildiumDelete(tenantId, noteId).then((success) => {
  if (success) {
    console.log('\n' + '='.repeat(60));
    console.log('✅ DELETE endpoint works!');
  } else {
    console.log('\n' + '='.repeat(60));
    console.log('❌ DELETE endpoint does not work or does not exist');
    console.log('   Buildium API does not support DELETE for tenant notes');
  }
  console.log('='.repeat(60) + '\n');
  process.exit(success ? 0 : 1);
});

