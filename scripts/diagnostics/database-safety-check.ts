#!/usr/bin/env npx tsx

/**
 * Database Safety Check Script
 * 
 * This script prevents accidental database resets by:
 * 1. Checking if destructive commands are being run
 * 2. Requiring explicit confirmation
 * 3. Providing safe alternatives
 */

import { config } from 'dotenv'

config({ path: '.env.local' })

const DANGEROUS_COMMANDS = [
  'supabase db reset',
  'supabase db reset --linked',
  'supabase db reset --local',
  'supabase db reset --yes',
  'supabase db reset --no-confirm'
]

const SAFE_ALTERNATIVES = {
  'supabase db reset': 'npx supabase db push (applies migrations without reset)',
  'supabase db reset --linked': 'npx supabase db push (applies migrations to linked project)',
  'supabase db reset --local': 'npx supabase db push --local (applies migrations to local)'
}

function checkCommand(command: string): boolean {
  return DANGEROUS_COMMANDS.some(dangerous => command.includes(dangerous))
}

function showSafetyWarning(command: string) {
  console.log('\n🚨 DATABASE SAFETY WARNING 🚨')
  console.log('================================')
  console.log(`Command: ${command}`)
  console.log('\n❌ This command will DESTROY ALL DATA in your database!')
  console.log('\n✅ Safe alternatives:')
  
  const alternative = SAFE_ALTERNATIVES[command.trim() as keyof typeof SAFE_ALTERNATIVES]
  if (alternative) {
    console.log(`   ${alternative}`)
  }
  
  console.log('\n📋 Safe database operations:')
  console.log('   • npx supabase db push (apply migrations)')
  console.log('   • npx supabase status (check status)')
  console.log('   • npx supabase db diff (check differences)')
  console.log('\n🛡️ If you really need to reset:')
  console.log('   1. Create a backup first: npx supabase db dump --local')
  console.log('   2. Get explicit user confirmation')
  console.log('   3. Use: npx supabase db reset --yes (with backup)')
  console.log('\n================================\n')
}

function main() {
  const args = process.argv.slice(2)
  const command = args.join(' ')
  
  if (checkCommand(command)) {
    showSafetyWarning(command)
    console.log('❌ Command blocked for safety. Use safe alternatives above.')
    process.exit(1)
  }
  
  console.log('✅ Command appears safe to run.')
}

if (require.main === module) {
  main()
}

export { checkCommand, showSafetyWarning }
