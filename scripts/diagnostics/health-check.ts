#!/usr/bin/env tsx
import { config } from 'dotenv'
config({ path: '.env.local' })

interface HealthCheck {
  category: string
  checks: Array<{
    name: string
    status: 'pass' | 'fail' | 'warning'
    message: string
  }>
}

async function runHealthChecks(): Promise<HealthCheck[]> {
  const results: HealthCheck[] = []
  
  // 1. Environment Variables Check
  const envCheck: HealthCheck = {
    category: 'Environment Variables',
    checks: []
  }
  
  const requiredEnvVars = [
    'BUILDIUM_BASE_URL',
    'BUILDIUM_CLIENT_ID', 
    'BUILDIUM_CLIENT_SECRET',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ]
  
  for (const envVar of requiredEnvVars) {
    envCheck.checks.push({
      name: envVar,
      status: process.env[envVar] ? 'pass' : 'fail',
      message: process.env[envVar] ? 'Set' : 'Missing'
    })
  }
  
  results.push(envCheck)
  
  // 2. API Endpoints Check
  const apiCheck: HealthCheck = {
    category: 'API Endpoints',
    checks: []
  }
  
  const endpoints = [
    { path: '/api/csrf', expectedStatus: 200, name: 'CSRF Token' },
    { path: '/auth/signin', expectedStatus: 200, name: 'Signin Page' },
    { path: '/api/properties', expectedStatus: 401, name: 'Properties API (Auth Required)' },
    { path: '/api/owners', expectedStatus: 401, name: 'Owners API (Auth Required)' }
  ]
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`http://localhost:3000${endpoint.path}`)
      const success = response.status === endpoint.expectedStatus
      apiCheck.checks.push({
        name: endpoint.name,
        status: success ? 'pass' : 'fail',
        message: `${response.status} (expected ${endpoint.expectedStatus})`
      })
    } catch (error) {
      apiCheck.checks.push({
        name: endpoint.name,
        status: 'fail',
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    }
  }
  
  results.push(apiCheck)
  
  // 3. Database Check
  const dbCheck: HealthCheck = {
    category: 'Database Health',
    checks: []
  }
  
  try {
    // Check if we can connect to the database
    const { execSync } = require('child_process')
    
    // Check key tables exist and have expected data
    const tableChecks = [
      'SELECT count(*) as count FROM public.organizations',
      'SELECT count(*) as count FROM public.properties', 
      'SELECT count(*) as count FROM public.units',
      'SELECT count(*) as count FROM public.owners',
      'SELECT count(*) as count FROM public.contacts',
      'SELECT count(*) as count FROM auth.users'
    ]
    
    for (const query of tableChecks) {
      try {
        const result = execSync(`psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -t -c "${query}"`, { encoding: 'utf8' })
        const count = parseInt(result.trim())
        const tableName = query.match(/FROM (\w+\.)?(\w+)/)?.[2] || 'unknown'
        
        dbCheck.checks.push({
          name: `${tableName} table`,
          status: count > 0 ? 'pass' : 'warning',
          message: `${count} records`
        })
      } catch (error) {
        const tableName = query.match(/FROM (\w+\.)?(\w+)/)?.[2] || 'unknown'
        dbCheck.checks.push({
          name: `${tableName} table`,
          status: 'fail',
          message: 'Query failed'
        })
      }
    }
    
    // Check for constraint violations
    try {
      const constraintCheck = execSync(`psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -t -c "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY';"`, { encoding: 'utf8' })
      const constraintCount = parseInt(constraintCheck.trim())
      
      dbCheck.checks.push({
        name: 'Foreign Key Constraints',
        status: constraintCount > 0 ? 'pass' : 'warning',
        message: `${constraintCount} constraints active`
      })
    } catch (error) {
      dbCheck.checks.push({
        name: 'Foreign Key Constraints',
        status: 'fail',
        message: 'Could not check constraints'
      })
    }
    
  } catch (error) {
    dbCheck.checks.push({
      name: 'Database Connection',
      status: 'fail',
      message: 'Cannot connect to database'
    })
  }
  
  results.push(dbCheck)
  
  return results
}

async function main() {
  console.log('🏥 Running comprehensive health check...\n')
  
  const results = await runHealthChecks()
  
  let totalChecks = 0
  let passedChecks = 0
  let failedChecks = 0
  let warnings = 0
  
  for (const category of results) {
    console.log(`📋 ${category.category}:`)
    
    for (const check of category.checks) {
      totalChecks++
      const icon = check.status === 'pass' ? '✅' : check.status === 'warning' ? '⚠️' : '❌'
      console.log(`   ${icon} ${check.name}: ${check.message}`)
      
      if (check.status === 'pass') passedChecks++
      else if (check.status === 'fail') failedChecks++
      else warnings++
    }
    console.log('')
  }
  
  console.log('📊 Overall Health Summary:')
  console.log(`   ✅ Passed: ${passedChecks}/${totalChecks}`)
  console.log(`   ⚠️  Warnings: ${warnings}/${totalChecks}`)
  console.log(`   ❌ Failed: ${failedChecks}/${totalChecks}`)
  console.log(`   📈 Health Score: ${Math.round((passedChecks / totalChecks) * 100)}%`)
  
  if (failedChecks === 0) {
    console.log('\n🎉 System is healthy and ready for development!')
  } else {
    console.log('\n🔧 Some issues need attention before full functionality.')
  }
}

if (require.main === module) {
  main().catch(console.error)
}

