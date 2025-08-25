#!/usr/bin/env node

/**
 * List Existing Owner Records
 * 
 * This script lists any existing owner records in the live database.
 */

console.log('🔍 Listing Existing Owner Records\n');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Utility functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

// List existing owners
async function listExistingOwners() {
  log('Listing existing owner records...');
  
  try {
    // Get all owner records
    const response = await fetch(`${SUPABASE_URL}/rest/v1/owners?select=*`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    log(`Response Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      log(`Error: ${errorText}`, 'error');
      return;
    }
    
    const owners = await response.json();
    
    if (owners.length > 0) {
      log(`Found ${owners.length} owner record(s):`, 'success');
      
      owners.forEach((owner, index) => {
        console.log(`\n📋 Owner ${index + 1}:`);
        console.log(`  ID: ${owner.id}`);
        console.log(`  Columns: ${Object.keys(owner).join(', ')}`);
        console.log(`  Data:`, JSON.stringify(owner, null, 2));
      });
    } else {
      log('No owner records found in the database', 'warning');
    }
    
  } catch (error) {
    log(`Error listing owners: ${error.message}`, 'error');
  }
}

// Run the check
if (require.main === module) {
  listExistingOwners()
    .then(() => {
      log('Owner listing completed', 'success');
      process.exit(0);
    })
    .catch(error => {
      log(`Unexpected error: ${error.message}`, 'error');
      process.exit(1);
    });
}

module.exports = { listExistingOwners };
