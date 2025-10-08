import 'dotenv/config'
import { buildiumSync } from '@/lib/buildium-sync'
import { supabase, supabaseAdmin } from '@/lib/db'

async function main() {
  const db = supabaseAdmin || supabase
  const { data: lease, error } = await db
    .from('lease')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (error || !lease) {
    console.error('Failed to load lease', error)
    process.exit(1)
  }

  const result = await buildiumSync.syncLeaseToBuildium(lease as any)
  console.log('Result:', result)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
