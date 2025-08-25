#!/usr/bin/env tsx

/**
 * Script Name: show-organization.ts
 * Purpose: Display the current script organization and help developers find scripts
 * Usage: npx tsx scripts/show-organization.ts [category]
 * 
 * Options:
 *   category    Show scripts in specific category (buildium, database, api, utils)
 *   --help      Show this help message
 */

import { readdirSync, statSync } from 'fs'
import { join } from 'path'

interface ScriptInfo {
  name: string
  path: string
  category: string
  description: string
}

const scriptDescriptions: Record<string, string> = {
  // Buildium Sync Scripts
  'sync-buildium-bank-accounts.ts': 'Sync bank accounts from Buildium to local database',
  'fetch-all-lease-transactions.ts': 'Fetch all lease transactions from Buildium',
  'populate-relationships.ts': 'Populate relationships between entities',
  'get-buildium-property.ts': 'Get property details from Buildium',
  'get-buildium-property-direct.ts': 'Get property details directly from Buildium API',
  'sync-buildium-units-7647.ts': 'Sync units for property 7647 from Buildium',
  'fetch-owner-50685.ts': 'Fetch owner details from Buildium',
  'fetch-units-7647.ts': 'Fetch units for property 7647 from Buildium',
  'resync-property-7647-fixed.ts': 'Resync property 7647 with fixes',
  'populate-lease-relationship-to-transaction-lines.ts': 'Populate lease relationships to transaction lines',

  // Buildium Create Scripts
  'create-buildium-lease-records.ts': 'Create lease records in Buildium',
  'create-buildium-transaction-lines.ts': 'Create transaction lines in Buildium',
  'create-buildium-journal-entries.ts': 'Create journal entries in Buildium',
  'create-buildium-charge-records.ts': 'Create charge records in Buildium',
  'create-buildium-gl-accounts.ts': 'Create general ledger accounts in Buildium',
  'create-buildium-rent-schedule-record.ts': 'Create rent schedule records in Buildium',
  'create-journal-entries-from-transactions.ts': 'Create journal entries from transactions',
  'create-transaction-lines-from-transactions.ts': 'Create transaction lines from transactions',
  'add-buildium-property.ts': 'Add a new property to Buildium',
  'link-property-bank-account.ts': 'Link property to bank account',
  'link-property-trust-account.ts': 'Link property to trust account',
  'set-property-trust-account.ts': 'Set property trust account',
  'update-owner-buildium-id.ts': 'Update owner Buildium ID',

  // Buildium Verify Scripts
  'verify-relationships.ts': 'Verify data relationships',
  'verify-buildium-transaction-lines.ts': 'Verify Buildium transaction lines',
  'verify-lease-creation.ts': 'Verify lease creation',
  'verify-buildium-charge-records.ts': 'Verify Buildium charge records',
  'verify-rent-schedule-creation.ts': 'Verify rent schedule creation',
  'verify-complete-relationships-with-transaction-lines.ts': 'Verify complete relationships with transaction lines',
  'verify-all-transactions.ts': 'Verify all transactions',
  'check-property-fields.ts': 'Check property fields',
  'check-property-unit-exist.ts': 'Check if property unit exists',
  'check-unit-created.ts': 'Check if unit was created',
  'check-lease-structure.ts': 'Check lease structure',
  'check-gl-accounts.ts': 'Check general ledger accounts',
  'check-charge-data.ts': 'Check charge data',
  'check-local-property.ts': 'Check local property data',

  // Buildium Cleanup Scripts
  'cleanup-duplicate-journal-entries.ts': 'Clean up duplicate journal entries',
  'cleanup-duplicate-transaction-lines.ts': 'Clean up duplicate transaction lines',
  'delete-all-properties.ts': 'Delete all properties',

  // API Testing Scripts
  'explore-buildium-rent-endpoints.ts': 'Explore Buildium rent endpoints',

  // Utility Scripts
  'buildium-api-reference.ts': 'Buildium API reference documentation',
  'generate-component-docs.ts': 'Generate component documentation',
  'generate-db-docs.ts': 'Generate database documentation',
  'cursor-ai-agent.ts': 'Cursor AI agent integration',
  'cursor-ai-integration.ts': 'Cursor AI integration',
  'doc-watcher.ts': 'Documentation watcher',
  'update-readme.ts': 'Update README files'
}

function getScriptsInDirectory(dir: string, category: string): ScriptInfo[] {
  const scripts: ScriptInfo[] = []
  
  try {
    const files = readdirSync(dir)
    
    for (const file of files) {
      const fullPath = join(dir, file)
      const stat = statSync(fullPath)
      
      if (stat.isFile() && file.endsWith('.ts') || file.endsWith('.js')) {
        scripts.push({
          name: file,
          path: fullPath.replace('scripts/', ''),
          category,
          description: scriptDescriptions[file] || 'No description available'
        })
      } else if (stat.isDirectory() && !file.startsWith('.')) {
        scripts.push(...getScriptsInDirectory(fullPath, `${category}/${file}`))
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error)
  }
  
  return scripts
}

function displayScripts(scripts: ScriptInfo[], category?: string) {
  if (category) {
    const filteredScripts = scripts.filter(s => s.category.startsWith(category))
    if (filteredScripts.length === 0) {
      console.log(`No scripts found in category: ${category}`)
      return
    }
    scripts = filteredScripts
  }

  const categories = [...new Set(scripts.map(s => s.category))]
  
  for (const cat of categories.sort()) {
    const categoryScripts = scripts.filter(s => s.category === cat)
    
    console.log(`\n📁 ${cat.toUpperCase()}`)
    console.log('='.repeat(cat.length + 3))
    
    for (const script of categoryScripts.sort((a, b) => a.name.localeCompare(b.name))) {
      console.log(`\n📄 ${script.name}`)
      console.log(`   Path: scripts/${script.path}`)
      console.log(`   Description: ${script.description}`)
      console.log(`   Usage: npx tsx scripts/${script.path}`)
    }
  }
}

function showHelp() {
  console.log(`
Script Organization Viewer

Usage: npx tsx scripts/show-organization.ts [category]

Categories:
  buildium     Show all Buildium integration scripts
  database     Show all database scripts
  api          Show all API scripts
  utils        Show all utility scripts
  sync         Show all sync scripts
  create       Show all creation scripts
  verify       Show all verification scripts
  cleanup      Show all cleanup scripts

Examples:
  npx tsx scripts/show-organization.ts
  npx tsx scripts/show-organization.ts buildium
  npx tsx scripts/show-organization.ts sync
  npx tsx scripts/show-organization.ts --help

This script helps you find and understand available scripts in the project.
  `)
}

async function main() {
  const args = process.argv.slice(2)
  const category = args[0]
  const showHelpFlag = args.includes('--help')

  if (showHelpFlag) {
    showHelp()
    return
  }

  console.log('🔍 Script Organization Report')
  console.log('='.repeat(50))
  console.log(`Generated: ${new Date().toLocaleString()}`)
  console.log(`Total Scripts: ${Object.keys(scriptDescriptions).length}`)

  const allScripts = getScriptsInDirectory('scripts', '')
  
  if (category) {
    console.log(`\n📂 Showing scripts in category: ${category}`)
    displayScripts(allScripts, category)
  } else {
    console.log('\n📂 All Scripts by Category:')
    displayScripts(allScripts)
  }

  console.log('\n💡 Tips:')
  console.log('• Use --help with any script to see its usage')
  console.log('• Check scripts/README.md for detailed documentation')
  console.log('• Scripts are organized by functionality and purpose')
  console.log('• All scripts support TypeScript and can be run with tsx')
}

main().catch(console.error)
