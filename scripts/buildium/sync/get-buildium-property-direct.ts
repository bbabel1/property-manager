#!/usr/bin/env tsx

import 'dotenv/config'

interface MCPRequest {
  jsonrpc: '2.0'
  id: string
  method: string
  params: any
}

interface MCPResponse {
  jsonrpc: '2.0'
  id: string
  result?: any
  error?: {
    code: number
    message: string
  }
}

async function makeMCPRequest(method: string, params: any): Promise<any> {
  const request: MCPRequest = {
    jsonrpc: '2.0',
    id: Math.random().toString(36).substr(2, 9),
    method,
    params
  }

  console.log(`Making MCP request: ${method}`)
  console.log('Request params:', JSON.stringify(params, null, 2))

  try {
    const response = await fetch('http://localhost:3001', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result: MCPResponse = await response.json()
    
    if (result.error) {
      throw new Error(`MCP error: ${result.error.message}`)
    }

    return result.result
  } catch (error) {
    console.error('MCP request failed:', error)
    throw error
  }
}

async function getBuildiumProperty(propertyId: number) {
  console.log(`Fetching property details from Buildium for property ID: ${propertyId}`)
  
  try {
    // First, let's check if the MCP server is available
    console.log('Checking MCP server availability...')
    
    const result = await makeMCPRequest('properties/get', {
      propertyId: propertyId
    })
    
    console.log('\n✅ Property details retrieved successfully:')
    console.log(JSON.stringify(result, null, 2))
    
  } catch (error) {
    console.error('\n❌ Failed to retrieve property details:')
    console.error('Error:', error)
    
    // Try alternative method
    try {
      console.log('\n🔄 Trying alternative method...')
      const result = await makeMCPRequest('properties/list', {
        limit: 100,
        offset: 0
      })
      
      console.log('\n✅ Properties list retrieved:')
      console.log(JSON.stringify(result, null, 2))
      
      // Look for property with ID 7647
      if (result && Array.isArray(result)) {
        const targetProperty = result.find((p: any) => p.Id === propertyId)
        if (targetProperty) {
          console.log(`\n🎯 Found property ${propertyId}:`)
          console.log(JSON.stringify(targetProperty, null, 2))
        } else {
          console.log(`\n❌ Property ${propertyId} not found in the list`)
        }
      }
      
    } catch (altError) {
      console.error('\n❌ Alternative method also failed:', altError)
    }
  }
}

// Execute the function
const propertyId = 7647
getBuildiumProperty(propertyId)
  .then(() => {
    console.log('\nScript completed.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })
