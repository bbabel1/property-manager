// Buildium API Endpoint Validation System
// Systematically validates all Buildium API endpoints to ensure they're correct

interface EndpointTest {
  name: string
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  testData?: any
  expectedStatus: number[]
  critical: boolean
}

interface ValidationResult {
  endpoint: string
  method: string
  status: 'PASS' | 'FAIL' | 'WARNING'
  actualStatus?: number
  expectedStatus: number[]
  error?: string
  responseTime?: number
}

export class BuildiumEndpointValidator {
  private baseUrl: string
  private clientId: string
  private clientSecret: string

  constructor() {
    this.baseUrl = process.env.BUILDIUM_BASE_URL!
    this.clientId = process.env.BUILDIUM_CLIENT_ID!
    this.clientSecret = process.env.BUILDIUM_CLIENT_SECRET!
  }

  /**
   * Complete endpoint validation test suite
   */
  async validateAllEndpoints(): Promise<ValidationResult[]> {
    const endpoints = this.getEndpointTestSuite()
    const results: ValidationResult[] = []

    for (const test of endpoints) {
      console.log(`Testing ${test.method} ${test.endpoint}...`)
      const result = await this.testEndpoint(test)
      results.push(result)
      
      // Add delay to respect rate limits
      await this.delay(100)
    }

    return results
  }

  /**
   * Define all endpoints to test based on current codebase usage
   */
  private getEndpointTestSuite(): EndpointTest[] {
    return [
      // Properties - CRITICAL
      {
        name: 'List Properties',
        endpoint: '/rentals',
        method: 'GET',
        expectedStatus: [200],
        critical: true
      },
      {
        name: 'Get Property by ID',
        endpoint: '/rentals/7647', // Use known test property
        method: 'GET',
        expectedStatus: [200, 404],
        critical: true
      },
      {
        name: 'Create Property',
        endpoint: '/rentals',
        method: 'POST',
        expectedStatus: [201, 400, 422],
        testData: this.getMinimalPropertyData(),
        critical: true
      },

      // Units - CRITICAL
      {
        name: 'List Units',
        endpoint: '/rentals/units',
        method: 'GET',
        expectedStatus: [200],
        critical: true
      },
      {
        name: 'Get Unit by ID',
        endpoint: '/rentals/units/20616', // Use known test unit
        method: 'GET',
        expectedStatus: [200, 404],
        critical: true
      },

      // Leases - CRITICAL
      {
        name: 'List Leases',
        endpoint: '/leases',
        method: 'GET',
        expectedStatus: [200],
        critical: true
      },
      {
        name: 'Get Lease by ID',
        endpoint: '/leases/16235', // Use known test lease
        method: 'GET',
        expectedStatus: [200, 404],
        critical: true
      },

      // Tenants - RECENTLY FIXED - CRITICAL TO VERIFY
      {
        name: 'List Tenants',
        endpoint: '/leases/tenants',
        method: 'GET',
        expectedStatus: [200],
        critical: true
      },
      {
        name: 'Get Tenant by ID',
        endpoint: '/leases/tenants/52147', // Use known test tenant
        method: 'GET',
        expectedStatus: [200, 404],
        critical: true
      },

      // Bank Accounts
      {
        name: 'List Bank Accounts',
        endpoint: '/bankaccounts',
        method: 'GET',
        expectedStatus: [200],
        critical: false
      },
      {
        name: 'Get Bank Account by ID',
        endpoint: '/bankaccounts/1', // Test ID
        method: 'GET',
        expectedStatus: [200, 404],
        critical: false
      },

      // General Ledger
      {
        name: 'List GL Accounts',
        endpoint: '/glaccounts',
        method: 'GET',
        expectedStatus: [200],
        critical: false
      },
      {
        name: 'List GL Entries',
        endpoint: '/glentries',
        method: 'GET',
        expectedStatus: [200],
        critical: false
      },

      // Owners
      {
        name: 'List Owners',
        endpoint: '/associations/owners',
        method: 'GET',
        expectedStatus: [200],
        critical: true
      },
      {
        name: 'Get Owner by ID',
        endpoint: '/associations/owners/1', // Test ID
        method: 'GET',
        expectedStatus: [200, 404],
        critical: true
      },

      // Bills
      {
        name: 'List Bills',
        endpoint: '/bills',
        method: 'GET',
        expectedStatus: [200],
        critical: false
      },

      // Files
      {
        name: 'List Files',
        endpoint: '/files',
        method: 'GET',
        expectedStatus: [200],
        critical: false
      },

      // Work Orders
      {
        name: 'List Work Orders',
        endpoint: '/workorders',
        method: 'GET',
        expectedStatus: [200],
        critical: false
      },

      // Account Info
      {
        name: 'Get Account Info',
        endpoint: '/accountinfo',
        method: 'GET',
        expectedStatus: [200],
        critical: false
      }
    ]
  }

  /**
   * Test individual endpoint
   */
  private async testEndpoint(test: EndpointTest): Promise<ValidationResult> {
    const startTime = Date.now()
    
    try {
      const url = `${this.baseUrl}${test.endpoint}`
      const config: RequestInit = {
        method: test.method,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'x-buildium-client-id': this.clientId,
          'x-buildium-client-secret': this.clientSecret,
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      }

      if (test.testData && test.method !== 'GET') {
        config.body = JSON.stringify(test.testData)
      }

      const response = await fetch(url, config)
      const responseTime = Date.now() - startTime

      const result: ValidationResult = {
        endpoint: test.endpoint,
        method: test.method,
        status: test.expectedStatus.includes(response.status) ? 'PASS' : 'FAIL',
        actualStatus: response.status,
        expectedStatus: test.expectedStatus,
        responseTime
      }

      if (result.status === 'FAIL') {
        const errorText = await response.text().catch(() => 'Unable to read error response')
        result.error = `Expected ${test.expectedStatus.join(' or ')}, got ${response.status}: ${errorText}`
      }

      return result

    } catch (error) {
      const responseTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        endpoint: test.endpoint,
        method: test.method,
        status: 'FAIL',
        expectedStatus: test.expectedStatus,
        error: `Network error: ${errorMessage}`,
        responseTime
      }
    }
  }

  /**
   * Generate validation report
   */
  generateReport(results: ValidationResult[]): string {
    const critical = results.filter(r => this.getEndpointTestSuite().find(t => t.endpoint === r.endpoint)?.critical)
    const nonCritical = results.filter(r => !this.getEndpointTestSuite().find(t => t.endpoint === r.endpoint)?.critical)

    const criticalFailed = critical.filter(r => r.status === 'FAIL')
    const nonCriticalFailed = nonCritical.filter(r => r.status === 'FAIL')

    let report = `# Buildium API Endpoint Validation Report\n\n`
    report += `**Generated:** ${new Date().toISOString()}\n\n`
    report += `## Summary\n\n`
    report += `- **Total Endpoints Tested:** ${results.length}\n`
    report += `- **Critical Endpoints:** ${critical.length} (${critical.filter(r => r.status === 'PASS').length} passed)\n`
    report += `- **Non-Critical Endpoints:** ${nonCritical.length} (${nonCritical.filter(r => r.status === 'PASS').length} passed)\n`
    report += `- **Critical Failures:** ${criticalFailed.length}\n`
    report += `- **Non-Critical Failures:** ${nonCriticalFailed.length}\n\n`

    if (criticalFailed.length > 0) {
      report += `## ❌ CRITICAL FAILURES - IMMEDIATE ACTION REQUIRED\n\n`
      criticalFailed.forEach(result => {
        report += `### ${result.method} ${result.endpoint}\n`
        report += `- **Status:** ${result.actualStatus}\n`
        report += `- **Expected:** ${result.expectedStatus.join(' or ')}\n`
        report += `- **Error:** ${result.error}\n`
        report += `- **Response Time:** ${result.responseTime}ms\n\n`
      })
    }

    if (nonCriticalFailed.length > 0) {
      report += `## ⚠️ Non-Critical Failures\n\n`
      nonCriticalFailed.forEach(result => {
        report += `### ${result.method} ${result.endpoint}\n`
        report += `- **Status:** ${result.actualStatus}\n`
        report += `- **Expected:** ${result.expectedStatus.join(' or ')}\n`
        report += `- **Error:** ${result.error}\n`
        report += `- **Response Time:** ${result.responseTime}ms\n\n`
      })
    }

    const passed = results.filter(r => r.status === 'PASS')
    if (passed.length > 0) {
      report += `## ✅ Passed Endpoints\n\n`
      passed.forEach(result => {
        const test = this.getEndpointTestSuite().find(t => t.endpoint === result.endpoint)
        report += `- **${result.method} ${result.endpoint}** (${test?.critical ? 'Critical' : 'Non-Critical'}) - ${result.responseTime}ms\n`
      })
    }

    return report
  }

  /**
   * Get minimal property data for testing
   */
  private getMinimalPropertyData() {
    return {
      Name: 'API Test Property',
      PropertyType: 'Rental',
      Address: {
        AddressLine1: '123 Test Street',
        City: 'Test City',
        State: 'CA',
        PostalCode: '12345',
        Country: 'United States'
      }
    }
  }

  /**
   * Rate limiting delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Automated endpoint validation script
 */
export async function runEndpointValidation(): Promise<void> {
  console.log('🔍 Starting Buildium API endpoint validation...')
  
  const validator = new BuildiumEndpointValidator()
  const results = await validator.validateAllEndpoints()
  const report = validator.generateReport(results)
  
  // Save report to file
  const fs = await import('fs')
  const reportPath = `docs/buildium-endpoint-validation-${Date.now()}.md`
  fs.writeFileSync(reportPath, report)
  
  console.log(`📊 Validation complete. Report saved to: ${reportPath}`)
  
  // Log critical failures
  const criticalFailures = results.filter(r => {
    const test = validator['getEndpointTestSuite']().find(t => t.endpoint === r.endpoint)
    return test?.critical && r.status === 'FAIL'
  })
  
  if (criticalFailures.length > 0) {
    console.error('❌ CRITICAL ENDPOINT FAILURES DETECTED:')
    criticalFailures.forEach(failure => {
      console.error(`  - ${failure.method} ${failure.endpoint}: ${failure.error}`)
    })
  } else {
    console.log('✅ All critical endpoints are functioning correctly')
  }
}
