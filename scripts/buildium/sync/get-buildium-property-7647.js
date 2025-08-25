#!/usr/bin/env node

/**
 * Direct Buildium API Script to fetch Property ID: 7647
 */

console.log('🔍 Fetching Property ID: 7647 from Buildium API\n');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Configuration
const BUILDIUM_PROPERTY_ID = 7647;
const BUILDIUM_BASE_URL = process.env.BUILDIUM_BASE_URL || 'https://apisandbox.buildium.com/v1';
const BUILDIUM_CLIENT_ID = process.env.BUILDIUM_CLIENT_ID;
const BUILDIUM_CLIENT_SECRET = process.env.BUILDIUM_CLIENT_SECRET;

// Utility functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

// AWS Signature Version 4 implementation
function createSignatureV4(method, path, queryString, headers, body, service, region) {
  const crypto = require('crypto');
  
  // Add Host header if not present
  if (!headers['Host']) {
    headers['Host'] = 'apisandbox.buildium.com';
  }
  
  // Create canonical request
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map(key => `${key.toLowerCase()}:${headers[key].trim()}`)
    .join('\n') + '\n';
  
  const signedHeaders = Object.keys(headers)
    .sort()
    .map(key => key.toLowerCase())
    .join(';');
  
  const payloadHash = crypto.createHash('sha256').update(body || '').digest('hex');
  
  const canonicalRequest = [
    method,
    path,
    queryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');
  
  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const date = headers['X-Amz-Date'].substring(0, 8);
  const credentialScope = `${date}/${region}/${service}/aws4_request`;
  
  const stringToSign = [
    algorithm,
    headers['X-Amz-Date'],
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');
  
  // Calculate signature
  const dateKey = crypto.createHmac('sha256', `AWS4${BUILDIUM_CLIENT_SECRET}`).update(date).digest();
  const dateRegionKey = crypto.createHmac('sha256', dateKey).update(region).digest();
  const dateRegionServiceKey = crypto.createHmac('sha256', dateRegionKey).update(service).digest();
  const signingKey = crypto.createHmac('sha256', dateRegionServiceKey).update('aws4_request').digest();
  
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  
  return `${algorithm} Credential=${BUILDIUM_CLIENT_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

// Fetch property from Buildium API
async function getBuildiumProperty(propertyId) {
  log(`Fetching property ${propertyId} from Buildium API...`);
  
  const regions = ['us-east-1', 'us-west-2', 'us-east-2', 'us-west-1', 'eu-west-1', 'ap-southeast-1', 'ca-central-1'];
  const services = ['execute-api', 'buildium', 'api'];
  
  for (const region of regions) {
    for (const service of services) {
      log(`Trying region: ${region}, service: ${service}`);
      
      try {
        const method = 'GET';
        const path = `/properties/${propertyId}`;
        const queryString = '';
        const body = '';
        
        const headers = {
          'Content-Type': 'application/json',
          'X-Amz-Date': new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
        };
        
        const authorization = createSignatureV4(method, path, queryString, headers, body, service, region);
        headers['Authorization'] = authorization;
        
        const url = `${BUILDIUM_BASE_URL}${path}`;
        
        log(`Making request to: ${url}`);
        
        const response = await fetch(url, {
          method,
          headers
        });
        
        if (response.ok) {
          const data = await response.json();
          log(`✅ Successfully fetched property ${propertyId}!`, 'success');
          console.log('\n📋 Property Details:');
          console.log(JSON.stringify(data, null, 2));
          return data;
        } else {
          const errorText = await response.text();
          log(`HTTP ${response.status}: ${errorText}`, 'warning');
        }
        
      } catch (error) {
        log(`Error with ${region}/${service}: ${error.message}`, 'warning');
      }
    }
  }
  
  throw new Error('Failed to fetch property from all region/service combinations');
}

// Main execution
async function main() {
  try {
    if (!BUILDIUM_CLIENT_ID || !BUILDIUM_CLIENT_SECRET) {
      throw new Error('BUILDIUM_CLIENT_ID and BUILDIUM_CLIENT_SECRET must be set in environment variables');
    }
    
    log(`Using Buildium API: ${BUILDIUM_BASE_URL}`);
    log(`Client ID: ${BUILDIUM_CLIENT_ID}`);
    
    const property = await getBuildiumProperty(BUILDIUM_PROPERTY_ID);
    
    log('Script completed successfully!', 'success');
    
  } catch (error) {
    log(`Script failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

main();
