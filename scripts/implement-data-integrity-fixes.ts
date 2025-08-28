#!/usr/bin/env npx tsx
// Implementation script for data integrity fixes
// Run this script to implement all the data integrity solutions

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
config({ path: '.env.local' })

// Import our new systems
import { validateDataIntegrity, VALIDATION_SQL_FUNCTIONS } from '../src/lib/data-integrity-validator'
import { BuildiumEndpointValidator } from '../src/lib/buildium-endpoint-validator'
import { runSyncRecovery, SYNC_OPERATIONS_TABLE_SQL } from '../src/lib/sync-error-recovery'

async function main() {
  console.log('🚀 Starting data integrity implementation...')

  // Initialize Supabase client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // Step 1: Create necessary database functions and tables
    console.log('\n📊 Step 1: Setting up database functions...')
    
    // Add validation functions
    const { error: funcError } = await supabase.rpc('exec_sql', { 
      sql: VALIDATION_SQL_FUNCTIONS 
    })
    
    if (funcError) {
      console.error('Failed to create validation functions:', funcError)
      console.log('⚠️ You may need to run this SQL manually in your database:')
      console.log(VALIDATION_SQL_FUNCTIONS)
    } else {
      console.log('✅ Validation functions created successfully')
    }

    // Add sync operations table
    const { error: tableError } = await supabase.rpc('exec_sql', { 
      sql: SYNC_OPERATIONS_TABLE_SQL 
    })
    
    if (tableError) {
      console.error('Failed to create sync operations table:', tableError)
      console.log('⚠️ You may need to run this SQL manually in your database:')
      console.log(SYNC_OPERATIONS_TABLE_SQL)
    } else {
      console.log('✅ Sync operations table created successfully')
    }

    // Step 2: Validate current data integrity
    console.log('\n🔍 Step 2: Validating current data integrity...')
    
    const validationResult = await validateDataIntegrity(supabase)
    
    console.log(`📊 Validation Results:`)
    console.log(`   - Valid: ${validationResult.isValid}`)
    console.log(`   - Errors: ${validationResult.errors.length}`)
    console.log(`   - Warnings: ${validationResult.warnings.length}`)
    console.log(`   - Orphaned Records: ${validationResult.orphanedRecords.length}`)

    if (validationResult.errors.length > 0) {
      console.log('\n❌ Data Integrity Errors:')
      validationResult.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`)
      })
    }

    if (validationResult.warnings.length > 0) {
      console.log('\n⚠️ Data Integrity Warnings:')
      validationResult.warnings.forEach((warning, index) => {
        console.log(`   ${index + 1}. ${warning}`)
      })
    }

    if (validationResult.orphanedRecords.length > 0) {
      console.log('\n🔗 Orphaned Records:')
      validationResult.orphanedRecords.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.table}/${record.id} - ${record.reason}`)
      })
    }

    // Step 3: Validate API endpoints
    console.log('\n🌐 Step 3: Validating Buildium API endpoints...')
    
    const endpointValidator = new BuildiumEndpointValidator()
    const endpointResults = await endpointValidator.validateAllEndpoints()
    
    const criticalFailures = endpointResults.filter(r => {
      const testSuite = endpointValidator['getEndpointTestSuite']()
      const test = testSuite.find(t => t.endpoint === r.endpoint)
      return test?.critical && r.status === 'FAIL'
    })

    const nonCriticalFailures = endpointResults.filter(r => {
      const testSuite = endpointValidator['getEndpointTestSuite']()
      const test = testSuite.find(t => t.endpoint === r.endpoint)
      return !test?.critical && r.status === 'FAIL'
    })

    console.log(`📊 Endpoint Validation Results:`)
    console.log(`   - Total Endpoints: ${endpointResults.length}`)
    console.log(`   - Passed: ${endpointResults.filter(r => r.status === 'PASS').length}`)
    console.log(`   - Critical Failures: ${criticalFailures.length}`)
    console.log(`   - Non-Critical Failures: ${nonCriticalFailures.length}`)

    if (criticalFailures.length > 0) {
      console.log('\n❌ CRITICAL API ENDPOINT FAILURES:')
      criticalFailures.forEach((failure, index) => {
        console.log(`   ${index + 1}. ${failure.method} ${failure.endpoint}: ${failure.error}`)
      })
    }

    // Step 4: Recover failed sync operations
    console.log('\n🔄 Step 4: Recovering failed sync operations...')
    
    const recoveryResult = await runSyncRecovery(supabase)
    
    console.log(`📊 Recovery Results:`)
    console.log(`   - Recovered: ${recoveryResult.recovered}`)
    console.log(`   - Failed: ${recoveryResult.failed}`)
    console.log(`   - Skipped: ${recoveryResult.skipped}`)

    if (recoveryResult.errors.length > 0) {
      console.log('\n❌ Recovery Errors:')
      recoveryResult.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`)
      })
    }

    // Step 5: Generate summary report
    console.log('\n📋 Step 5: Generating summary report...')
    
    const report = generateSummaryReport({
      validation: validationResult,
      endpoints: endpointResults,
      recovery: recoveryResult,
      criticalFailures
    })

    // Save report to file
    const fs = await import('fs')
    const reportPath = `docs/data-integrity-report-${Date.now()}.md`
    fs.writeFileSync(reportPath, report)
    
    console.log(`📄 Summary report saved to: ${reportPath}`)

    // Final recommendations
    console.log('\n🎯 NEXT STEPS:')
    
    if (criticalFailures.length > 0) {
      console.log('❌ CRITICAL: Fix API endpoint failures immediately')
      console.log('   - Review the endpoint validation report')
      console.log('   - Update incorrect endpoints in your code')
      console.log('   - Re-run this script to verify fixes')
    }

    if (validationResult.errors.length > 0) {
      console.log('⚠️ HIGH: Address data integrity errors')
      console.log('   - Review orphaned records and fix relationships')
      console.log('   - Ensure all required fields are populated')
      console.log('   - Consider running data cleanup scripts')
    }

    if (recoveryResult.failed > 0) {
      console.log('📋 MEDIUM: Review failed sync operations')
      console.log('   - Check the sync_operations table for details')
      console.log('   - Manually resolve operations that couldn\'t be recovered')
      console.log('   - Consider adjusting retry logic if needed')
    }

    console.log('\n✅ Data integrity implementation completed!')
    console.log('📊 Run this script regularly to monitor data health')

  } catch (error) {
    console.error('💥 Implementation failed:', error)
    process.exit(1)
  }
}

function generateSummaryReport(data: any): string {
  const { validation, endpoints, recovery, criticalFailures } = data

  let report = `# Data Integrity Implementation Report\n\n`
  report += `**Generated:** ${new Date().toISOString()}\n\n`

  // Executive Summary
  report += `## Executive Summary\n\n`
  
  if (criticalFailures.length > 0) {
    report += `🚨 **CRITICAL ISSUES DETECTED** - Immediate action required\n\n`
  } else if (validation.errors.length > 0) {
    report += `⚠️ **DATA INTEGRITY ISSUES** - High priority fixes needed\n\n`
  } else {
    report += `✅ **SYSTEM HEALTHY** - Minor issues detected\n\n`
  }

  report += `### Key Metrics\n`
  report += `- **Data Integrity:** ${validation.isValid ? '✅ Valid' : '❌ Invalid'} (${validation.errors.length} errors, ${validation.warnings.length} warnings)\n`
  report += `- **API Endpoints:** ${criticalFailures.length === 0 ? '✅ Healthy' : '❌ Critical failures'} (${criticalFailures.length} critical failures)\n`
  report += `- **Sync Recovery:** ${recovery.recovered} recovered, ${recovery.failed} failed\n\n`

  // Data Integrity Section
  report += `## Data Integrity Analysis\n\n`
  
  if (validation.errors.length > 0) {
    report += `### ❌ Critical Errors (${validation.errors.length})\n\n`
    validation.errors.forEach((error: string, index: number) => {
      report += `${index + 1}. ${error}\n`
    })
    report += `\n`
  }

  if (validation.warnings.length > 0) {
    report += `### ⚠️ Warnings (${validation.warnings.length})\n\n`
    validation.warnings.forEach((warning: string, index: number) => {
      report += `${index + 1}. ${warning}\n`
    })
    report += `\n`
  }

  if (validation.orphanedRecords.length > 0) {
    report += `### 🔗 Orphaned Records (${validation.orphanedRecords.length})\n\n`
    validation.orphanedRecords.forEach((record: any, index: number) => {
      report += `${index + 1}. **${record.table}** (ID: ${record.id}) - ${record.reason}\n`
    })
    report += `\n`
  }

  // API Endpoints Section
  report += `## API Endpoint Validation\n\n`
  
  if (criticalFailures.length > 0) {
    report += `### ❌ Critical Endpoint Failures\n\n`
    criticalFailures.forEach((failure: any, index: number) => {
      report += `${index + 1}. **${failure.method} ${failure.endpoint}**\n`
      report += `   - Status: ${failure.actualStatus}\n`
      report += `   - Expected: ${failure.expectedStatus.join(' or ')}\n`
      report += `   - Error: ${failure.error}\n\n`
    })
  }

  const passed = endpoints.filter((r: any) => r.status === 'PASS')
  if (passed.length > 0) {
    report += `### ✅ Healthy Endpoints (${passed.length})\n\n`
    passed.forEach((result: any) => {
      report += `- ${result.method} ${result.endpoint} (${result.responseTime}ms)\n`
    })
    report += `\n`
  }

  // Recovery Section
  if (recovery.recovered > 0 || recovery.failed > 0) {
    report += `## Sync Operation Recovery\n\n`
    report += `- **Recovered:** ${recovery.recovered} operations\n`
    report += `- **Failed:** ${recovery.failed} operations\n`
    report += `- **Skipped:** ${recovery.skipped} operations\n\n`

    if (recovery.errors.length > 0) {
      report += `### Recovery Errors\n\n`
      recovery.errors.forEach((error: string, index: number) => {
        report += `${index + 1}. ${error}\n`
      })
      report += `\n`
    }
  }

  // Recommendations
  report += `## Recommendations\n\n`
  
  if (criticalFailures.length > 0) {
    report += `### 🚨 Immediate Actions Required\n\n`
    report += `1. **Fix Critical API Endpoints** - Update incorrect endpoints in your codebase\n`
    report += `2. **Test API Connectivity** - Verify all critical endpoints are working\n`
    report += `3. **Update Documentation** - Ensure API documentation reflects correct endpoints\n\n`
  }

  if (validation.errors.length > 0) {
    report += `### ⚠️ High Priority Actions\n\n`
    report += `1. **Resolve Data Integrity Issues** - Fix orphaned records and missing relationships\n`
    report += `2. **Validate Required Fields** - Ensure all required fields are populated\n`
    report += `3. **Run Data Cleanup** - Consider running automated cleanup scripts\n\n`
  }

  report += `### 📋 Ongoing Maintenance\n\n`
  report += `1. **Regular Monitoring** - Run this validation script weekly\n`
  report += `2. **Automated Alerts** - Set up alerts for data integrity issues\n`
  report += `3. **Sync Monitoring** - Monitor sync operations for failures\n`
  report += `4. **Performance Tracking** - Track API response times and success rates\n\n`

  report += `---\n\n`
  report += `*Report generated by Data Integrity Implementation Script*\n`

  return report
}

// Run the script
if (require.main === module) {
  main().catch(console.error)
}
