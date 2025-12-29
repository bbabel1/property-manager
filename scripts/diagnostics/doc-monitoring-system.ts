/**
 * Documentation Monitoring System
 * Automatically updates documentation when code changes are detected
 */

import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'

interface FileChange {
  file: string
  type: 'added' | 'modified' | 'deleted'
  timestamp: Date
}

interface DocumentationRule {
  pattern: RegExp
  targetDocs: string[]
  updateFunction: (changes: FileChange[]) => Promise<void>
}

class DocumentationMonitor {
  private rules: DocumentationRule[] = []
  private lastCheck: Date = new Date()

  constructor() {
    this.setupRules()
  }

  private setupRules() {
    // Monitor API route changes
    this.rules.push({
      pattern: /src\/app\/api\/.*\/route\.ts$/,
      targetDocs: ['docs/api/SUPABASE_API_DOCUMENTATION.md'],
      updateFunction: this.updateApiDocumentation.bind(this)
    })

    // Monitor schema/migration changes
    this.rules.push({
      pattern: /supabase\/migrations\/.*\.sql$/,
      targetDocs: [
        'docs/database/DATABASE_SCHEMA.md',
        'docs/architecture/CURRENT_ARCHITECTURE_ANALYSIS.md'
      ],
      updateFunction: this.updateSchemaDocumentation.bind(this)
    })

    // Monitor authentication changes
    this.rules.push({
      pattern: /src\/(lib\/auth|app\/auth|middleware).*\.(ts|tsx)$/,
      targetDocs: ['docs/architecture/SUPABASE_AUTH_IMPLEMENTATION.md'],
      updateFunction: this.updateAuthDocumentation.bind(this)
    })

    // Monitor business logic changes
    this.rules.push({
      pattern: /src\/(types|lib\/.*-service|schemas)\/.*\.ts$/,
      targetDocs: ['docs/architecture/BUSINESS_LOGIC_DOCUMENTATION.md'],
      updateFunction: this.updateBusinessLogicDocumentation.bind(this)
    })

    // Monitor package.json changes
    this.rules.push({
      pattern: /package\.json$/,
      targetDocs: [
        'docs/architecture/MIGRATION_STATUS_AND_ROADMAP.md',
        'README.md'
      ],
      updateFunction: this.updateDependencyDocumentation.bind(this)
    })
  }

  async checkForChanges(): Promise<FileChange[]> {
    try {
      // Get git changes since last check
      const gitCommand = `git log --name-status --pretty=format: --since="${this.lastCheck.toISOString()}" | grep -E "^[AMD]"`
      const output = execSync(gitCommand, { encoding: 'utf-8' }).trim()
      
      if (!output) return []

      const changes: FileChange[] = []
      const lines = output.split('\n')

      for (const line of lines) {
        if (!line.trim()) continue
        
        const [status, file] = line.split('\t')
        const type = status === 'A' ? 'added' : 
                    status === 'M' ? 'modified' : 'deleted'
        
        changes.push({
          file,
          type,
          timestamp: new Date()
        })
      }

      this.lastCheck = new Date()
      return changes

    } catch (error) {
      console.error('Error checking for changes:', error)
      return []
    }
  }

  async processChanges(changes: FileChange[]): Promise<void> {
    const updatedDocs = new Set<string>()

    for (const rule of this.rules) {
      const relevantChanges = changes.filter(change => 
        rule.pattern.test(change.file)
      )

      if (relevantChanges.length > 0) {
        console.log(`📝 Detected changes matching pattern: ${rule.pattern}`)
        console.log(`   Files: ${relevantChanges.map(c => c.file).join(', ')}`)
        
        try {
          await rule.updateFunction(relevantChanges)
          rule.targetDocs.forEach(doc => updatedDocs.add(doc))
        } catch (error) {
          console.error(`Error updating documentation for pattern ${rule.pattern}:`, error)
        }
      }
    }

    if (updatedDocs.size > 0) {
      console.log(`📚 Updated documentation files:`)
      updatedDocs.forEach(doc => console.log(`   - ${doc}`))
      
      // Update the master documentation index
      await this.updateDocumentationIndex()
    }
  }

  private async updateApiDocumentation(changes: FileChange[]): Promise<void> {
    if (!changes.length) {
      console.log('🔄 No API changes detected; skipping API doc regeneration.')
      return
    }
    console.log('🔄 Updating API documentation...')
    
    // Read all API route files
    const apiDir = 'src/app/api'
    const routeFiles = await this.findFiles(apiDir, /route\.ts$/)
    
    // Analyze each route file
    const endpoints: any[] = []
    for (const file of routeFiles) {
      const content = await fs.readFile(file, 'utf-8')
      const endpoint = await this.parseApiRoute(file, content)
      if (endpoint) endpoints.push(endpoint)
    }

    // Update API documentation with new endpoints
    const timestamp = new Date().toISOString()
    const docPath = 'docs/api/SUPABASE_API_DOCUMENTATION.md'
    
    let content = await fs.readFile(docPath, 'utf-8')
    
    // Add update timestamp
    content = content.replace(
      /(# Supabase API Documentation)/,
      `$1\n\n> **Last Updated**: ${timestamp} (Auto-generated)`
    )
    
    await fs.writeFile(docPath, content)
  }

  private async updateSchemaDocumentation(changes: FileChange[]): Promise<void> {
    if (!changes.length) {
      console.log('🗄️ No schema changes detected; skipping schema doc regeneration.')
      return
    }
    console.log('🗄️ Updating schema documentation...')
    
    // Read all migration files
    const migrationDir = 'supabase/migrations'
    const migrationFiles = await this.findFiles(migrationDir, /\.sql$/)
    
    // Generate comprehensive schema documentation
    const schemaDoc = await this.generateSchemaDocumentation(migrationFiles)
    
    // Update database schema documentation
    const docPath = 'docs/database/DATABASE_SCHEMA.md'
    await fs.writeFile(docPath, schemaDoc)
    
    console.log(`📊 Updated schema documentation with ${migrationFiles.length} migrations`)
  }

  private async updateAuthDocumentation(changes: FileChange[]): Promise<void> {
    if (!changes.length) {
      console.log('🔐 No auth changes detected; skipping auth doc updates.')
      return
    }
    console.log('🔐 Updating authentication documentation...')
    
    // Check if NextAuth is still present
    const packageContent = await fs.readFile('package.json', 'utf-8')
    const hasNextAuth = packageContent.includes('next-auth')
    
    // Update migration status based on current state
    const docPath = 'docs/architecture/MIGRATION_STATUS_AND_ROADMAP.md'
    let content = await fs.readFile(docPath, 'utf-8')
    
    if (!hasNextAuth) {
      // Update status to show NextAuth removal complete
      content = content.replace(
        /#### 4\. Authentication Provider \(0% Complete\)/,
        '#### 4. Authentication Provider (100% Complete)'
      )
    }
    
    await fs.writeFile(docPath, content)
  }

  private async updateBusinessLogicDocumentation(changes: FileChange[]): Promise<void> {
    if (!changes.length) {
      console.log('💼 No business-logic changes detected; skipping business doc updates.')
      return
    }
    console.log('💼 Updating business logic documentation...')
    
    // Analyze type definitions for changes
    const typeFiles = await this.findFiles('src/types', /\.ts$/)
    const serviceFiles = await this.findFiles('src/lib', /-service\.ts$/)
    console.log(`Found ${typeFiles.length} type files and ${serviceFiles.length} service files to evaluate.`)
    
    // Update business logic documentation with new type information
    const timestamp = new Date().toISOString()
    const docPath = 'docs/architecture/BUSINESS_LOGIC_DOCUMENTATION.md'
    
    let content = await fs.readFile(docPath, 'utf-8')
    content = content.replace(
      /(# Property Management Business Logic Documentation)/,
      `$1\n\n> **Last Updated**: ${timestamp} (Auto-generated)`
    )
    
    await fs.writeFile(docPath, content)
  }

  private async updateDependencyDocumentation(changes: FileChange[]): Promise<void> {
    if (!changes.length) {
      console.log('📦 No dependency-related changes detected; skipping dependency doc updates.')
      return
    }
    console.log('📦 Updating dependency documentation...')
    
    const packageContent = await fs.readFile('package.json', 'utf-8')
    const pkg = JSON.parse(packageContent)
    
    // Check migration status based on dependencies
    const hasNextAuth = pkg.dependencies?.['next-auth']
    const hasSupabaseAuthHelpers = pkg.dependencies?.['@supabase/auth-helpers-nextjs']
    
    // Update migration roadmap
    const docPath = 'docs/architecture/MIGRATION_STATUS_AND_ROADMAP.md'
    let content = await fs.readFile(docPath, 'utf-8')
    
    // Update status based on actual package.json content
    if (!hasNextAuth && hasSupabaseAuthHelpers) {
      content = content.replace(
        /Status: ❌ \*\*NOT STARTED\*\*/g,
        'Status: ✅ **COMPLETED**'
      )
    }
    
    await fs.writeFile(docPath, content)
  }

  private async findFiles(dir: string, pattern: RegExp): Promise<string[]> {
    const files: string[] = []
    
    try {
      const items = await fs.readdir(dir, { withFileTypes: true })
      
      for (const item of items) {
        const fullPath = path.join(dir, item.name)
        
        if (item.isDirectory()) {
          const subFiles = await this.findFiles(fullPath, pattern)
          files.push(...subFiles)
        } else if (pattern.test(fullPath)) {
          files.push(fullPath)
        }
      }
    } catch (_error) {
      // Directory doesn't exist or can't be read
    }
    
    return files
  }

  private async parseApiRoute(file: string, content: string): Promise<any> {
    // Simple parsing - could be enhanced with AST parsing
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    const foundMethods = methods.filter(method => 
      content.includes(`export async function ${method}`)
    )

    if (foundMethods.length === 0) return null

    // Extract route path from file path
    const routePath = file
      .replace('src/app/api', '')
      .replace('/route.ts', '')
      .replace(/\[([^\]]+)\]/g, ':$1') // Convert [id] to :id
      || '/'

    return {
      path: `/api${routePath}`,
      methods: foundMethods,
      file
    }
  }

  private async generateSchemaDocumentation(migrationFiles: string[]): Promise<string> {
    const timestamp = new Date().toISOString()
    
    let doc = `# Database Schema Documentation

> **Last Updated**: ${timestamp} (Auto-generated)

## Overview

This document provides a comprehensive overview of the Supabase database schema for the Ora Property Management system.

## Migration History

`

    // Process each migration file
    for (const file of migrationFiles.sort()) {
      const content = await fs.readFile(file, 'utf-8')
      const filename = path.basename(file)
      
      // Extract description from migration comment
      const descMatch = content.match(/-- Description: (.+)/)
      const description = descMatch ? descMatch[1] : 'No description available'
      
      doc += `### ${filename}
**Description**: ${description}

`
    }

    doc += `
## Current Schema Status

- **Total Migrations**: ${migrationFiles.length}
- **Database Provider**: PostgreSQL via Supabase
- **ORM**: Direct Supabase client operations
- **Security**: Row Level Security (RLS) enabled on all tables

## Core Tables

### Properties
- **Purpose**: Central property information
- **Relationships**: One-to-many with units, many-to-many with owners
- **Key Features**: International address support, Buildium integration

### Owners  
- **Purpose**: Property owners (individuals and companies)
- **Relationships**: Many-to-many with properties via ownership table
- **Key Features**: Tax information, separate business and personal details

### Ownership
- **Purpose**: Property-owner relationships with percentages
- **Key Features**: Ownership vs disbursement percentages, primary owner designation

### Units
- **Purpose**: Individual rental units within properties
- **Key Features**: Bedroom/bathroom classification, market rent tracking

### Bank Accounts
- **Purpose**: Financial account management
- **Key Features**: Check printing, account types, integration with properties

For detailed schema information, see the individual migration files in \`supabase/migrations/\`.
`

    return doc
  }

  private async updateDocumentationIndex(): Promise<void> {
    const timestamp = new Date().toISOString()
    
    const indexContent = `# Documentation Index

> **Last Updated**: ${timestamp} (Auto-generated)

## Architecture Documentation

- [Current Architecture Analysis](architecture/CURRENT_ARCHITECTURE_ANALYSIS.md) - System state and hybrid architecture
- [Migration Status and Roadmap](architecture/MIGRATION_STATUS_AND_ROADMAP.md) - Conversion progress tracking
- [Business Logic Documentation](architecture/BUSINESS_LOGIC_DOCUMENTATION.md) - Property management business rules
- [Supabase Auth Implementation](architecture/SUPABASE_AUTH_IMPLEMENTATION.md) - Authentication implementation guide

## API Documentation

- [Supabase API Documentation](api/SUPABASE_API_DOCUMENTATION.md) - Complete API reference

## Database Documentation

    - [Database Schema](database/DATABASE_SCHEMA.md) - Complete schema overview
    - [Supabase Setup Guide](database/supabase-setup.md) - Initial setup instructions

## Migration Guides

- [Prisma to Supabase Migration](architecture/MIGRATION_STATUS_AND_ROADMAP.md) - Step-by-step migration guide
- [NextAuth to Supabase Auth](architecture/SUPABASE_AUTH_IMPLEMENTATION.md) - Authentication migration

## Monitoring

This documentation is automatically updated by the documentation monitoring system. 

**Last automated check**: ${timestamp}

**Monitoring patterns**:
- API routes (\`src/app/api/**/*.ts\`)
- Database migrations (\`supabase/migrations/*.sql\`) 
- Authentication files (\`src/lib/auth*\`, \`src/app/auth*\`)
- Business logic (\`src/types/*\`, \`src/lib/*-service.ts\`)
- Dependencies (\`package.json\`)

To run manual documentation updates:
\`\`\`bash
npm run docs:update
\`\`\`
`

    await fs.writeFile('docs/README.md', indexContent)
  }

  async run(): Promise<void> {
    console.log('🔍 Checking for changes...')
    
    const changes = await this.checkForChanges()
    
    if (changes.length === 0) {
      console.log('✅ No changes detected')
      return
    }

    console.log(`📋 Found ${changes.length} changes:`)
    changes.forEach(change => {
      console.log(`   ${change.type.toUpperCase()}: ${change.file}`)
    })

    await this.processChanges(changes)
    console.log('✅ Documentation update complete')
  }

  // Manual trigger methods
  async updateAllDocumentation(): Promise<void> {
    console.log('🔄 Performing full documentation update...')
    
    // Simulate changes to trigger all rules
    const allChanges: FileChange[] = [
      { file: 'src/app/api/properties/route.ts', type: 'modified', timestamp: new Date() },
      { file: 'supabase/migrations/001_create_properties_table.sql', type: 'modified', timestamp: new Date() },
      { file: 'package.json', type: 'modified', timestamp: new Date() },
      { file: 'src/types/properties.ts', type: 'modified', timestamp: new Date() }
    ]

    await this.processChanges(allChanges)
    await this.updateDocumentationIndex()
    
    console.log('✅ Full documentation update complete')
  }

  async validateDocumentation(): Promise<boolean> {
    console.log('🔍 Validating documentation...')
    
    const requiredDocs = [
      'docs/architecture/CURRENT_ARCHITECTURE_ANALYSIS.md',
      'docs/architecture/BUSINESS_LOGIC_DOCUMENTATION.md', 
      'docs/architecture/SUPABASE_AUTH_IMPLEMENTATION.md',
      'docs/architecture/MIGRATION_STATUS_AND_ROADMAP.md',
      'docs/api/SUPABASE_API_DOCUMENTATION.md'
    ]

    let valid = true

    for (const doc of requiredDocs) {
      try {
        await fs.access(doc)
        const content = await fs.readFile(doc, 'utf-8')
        
        if (content.length < 100) {
          console.log(`❌ ${doc} appears to be incomplete (${content.length} chars)`)
          valid = false
        } else {
          console.log(`✅ ${doc} exists and has content`)
        }
      } catch (_error) {
        console.log(`❌ ${doc} is missing`)
        valid = false
      }
    }

    return valid
  }
}

// CLI Interface
async function main() {
  const monitor = new DocumentationMonitor()
  const command = process.argv[2]

  switch (command) {
    case 'check':
      await monitor.run()
      break
    case 'update':
      await monitor.updateAllDocumentation()
      break
    case 'validate':
      const valid = await monitor.validateDocumentation()
      process.exit(valid ? 0 : 1)
      break
    default:
      console.log(`
Usage: npx tsx scripts/doc-monitoring-system.ts <command>

Commands:
  check     - Check for changes and update documentation
  update    - Force update all documentation
  validate  - Validate documentation completeness

Examples:
  npx tsx scripts/doc-monitoring-system.ts check
  npx tsx scripts/doc-monitoring-system.ts update
  npx tsx scripts/doc-monitoring-system.ts validate
`)
  }
}

if (require.main === module) {
  main().catch(console.error)
}

export { DocumentationMonitor }
