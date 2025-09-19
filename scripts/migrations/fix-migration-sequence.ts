#!/usr/bin/env tsx
import { readdirSync, statSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

const MIGRATIONS_DIR = 'supabase/migrations'

interface Migration {
  currentPath: string
  filename: string
  timestamp: string
  description: string
  sequenceNumber: number
  isLegacy: boolean
}

function extractMigrationInfo(filename: string): Omit<Migration, 'currentPath' | 'sequenceNumber'> {
  // Remove .sql extension
  const nameWithoutExt = filename.replace(/\.sql$/, '')
  
  // Legacy format: 001_description, 002_description, etc.
  const legacyMatch = nameWithoutExt.match(/^(\d{3})_(.+)$/)
  if (legacyMatch) {
    const [, num, description] = legacyMatch
    return {
      filename,
      timestamp: `2024010100${num.padStart(2, '0')}00`, // Convert to timestamp format
      description,
      isLegacy: true
    }
  }
  
  // Full timestamp format: 20250828143500_description
  const fullTimestampMatch = nameWithoutExt.match(/^(\d{14})_(.+)$/)
  if (fullTimestampMatch) {
    const [, timestamp, description] = fullTimestampMatch
    return {
      filename,
      timestamp,
      description,
      isLegacy: false
    }
  }
  
  // Incomplete timestamp format: 20250912_description (missing time)
  const incompleteTimestampMatch = nameWithoutExt.match(/^(\d{8})_(.+)$/)
  if (incompleteTimestampMatch) {
    const [, datepart, description] = incompleteTimestampMatch
    return {
      filename,
      timestamp: `${datepart}000000`, // Add midnight time
      description,
      isLegacy: false
    }
  }
  
  // Special case for files like "20250904_add_total_vacant_units_to_properties.sql"
  const specialMatch = nameWithoutExt.match(/^(\d{8})(.+)$/)
  if (specialMatch) {
    const [, datepart, description] = specialMatch
    return {
      filename,
      timestamp: `${datepart}000000`,
      description: description.startsWith('_') ? description.substring(1) : description,
      isLegacy: false
    }
  }
  
  throw new Error(`Cannot parse migration filename: ${filename}`)
}

function generateNewFilename(migration: Migration): string {
  const paddedSequence = migration.sequenceNumber.toString().padStart(3, '0')
  return `${migration.timestamp}_${paddedSequence}_${migration.description}.sql`
}

function main() {
  console.log('🔍 Analyzing migration files...')
  
  // Read all SQL files from migrations directory
  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql') && !f.includes('.bak'))
    .sort()
  
  console.log(`Found ${files.length} migration files`)
  
  // Parse migration information
  const migrations: Migration[] = files.map(filename => {
    const currentPath = join(MIGRATIONS_DIR, filename)
    const info = extractMigrationInfo(filename)
    
    return {
      currentPath,
      ...info,
      sequenceNumber: 0 // Will be assigned later
    }
  })
  
  // Sort by timestamp to get chronological order
  migrations.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  
  // Assign sequence numbers
  migrations.forEach((migration, index) => {
    migration.sequenceNumber = index + 1
  })
  
  console.log('\n📋 Migration sequence:')
  migrations.forEach(m => {
    console.log(`  ${m.sequenceNumber.toString().padStart(3, '0')}: ${m.description} (${m.timestamp})`)
  })
  
  // Check if any renames are needed
  const renames: Array<{ from: string; to: string }> = []
  
  for (const migration of migrations) {
    const newFilename = generateNewFilename(migration)
    const newPath = join(MIGRATIONS_DIR, newFilename)
    
    if (migration.currentPath !== newPath) {
      renames.push({
        from: migration.currentPath,
        to: newPath
      })
    }
  }
  
  if (renames.length === 0) {
    console.log('\n✅ All migrations are already properly named!')
    return
  }
  
  console.log(`\n🔄 Need to rename ${renames.length} files:`)
  renames.forEach(({ from, to }) => {
    console.log(`  ${from} -> ${to}`)
  })
  
  const isDryRun = !process.argv.includes('--apply')
  
  if (isDryRun) {
    console.log('\n⚠️  Dry run mode. Add --apply to execute renames.')
    console.log('⚠️  This will use "git mv" to preserve file history.')
    return
  }
  
  console.log('\n🚀 Executing renames...')
  
  for (const { from, to } of renames) {
    try {
      execSync(`git mv "${from}" "${to}"`, { stdio: 'inherit' })
      console.log(`✅ Renamed: ${from} -> ${to}`)
    } catch (error) {
      console.error(`❌ Failed to rename ${from}:`, error)
      process.exit(1)
    }
  }
  
  console.log('\n✅ All migrations have been renamed successfully!')
  console.log('📝 Files have been staged in git. Review with "git status" and commit when ready.')
}

if (require.main === module) {
  main()
}
