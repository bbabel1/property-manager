#!/usr/bin/env -S node --loader tsx
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { ensureBuildiumEnabledForScript } from '../ensure-enabled'

function parseArgs() {
  const args = process.argv.slice(2)
  const out: Record<string, string> = {}
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const val = args[i+1] && !args[i+1].startsWith('--') ? args[++i] : 'true'
      out[key] = val
    }
  }
  return out
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

async function main() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = process.env
  if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)')
    process.exit(1)
  }
  await ensureBuildiumEnabledForScript(process.env.DEFAULT_ORG_ID ?? null)
  const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)

  const args = parseArgs()
  const hours = Number(args.hours || '24')
  const now = new Date()
  const from = args.from ? new Date(args.from) : new Date(now.getTime() - hours * 3600 * 1000)
  const to = args.to ? new Date(args.to) : now
  const limit = Number(args.limit || '500')

  const lastupdatedfrom = isoDate(from)
  const lastupdatedto = isoDate(to)

  console.log('Incremental owner sync window:', { lastupdatedfrom, lastupdatedto, limit })

  const { data, error } = await supabase.functions.invoke('buildium-sync', {
    body: {
      entityType: 'owner',
      operation: 'syncFromBuildium',
      entityData: { lastupdatedfrom, lastupdatedto, limit }
    }
  })

  if (error) {
    console.error('Edge function error:', error)
    process.exit(1)
  }
  console.log('Sync result:', data)
}

main().catch((e) => { console.error(e); process.exit(1) })
