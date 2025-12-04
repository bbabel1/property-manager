/**
 * npx tsx scripts/seed_org.ts
 * Creates an org and attaches your dev user as org_admin.
 */
import { createClient } from '@supabase/supabase-js'

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !serviceKey) throw new Error('Missing Supabase env vars')

  const supabase = createClient(url, serviceKey)

  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .insert({ name: 'Ora PM Demo' })
    .select('*')
    .single()

  if (orgErr) throw orgErr

  const DEV_USER_ID = process.env.DEV_USER_ID!
  if (!DEV_USER_ID) throw new Error('Set DEV_USER_ID in env')

  const { error: memErr } = await supabase.from('org_memberships').insert({
    user_id: DEV_USER_ID,
    org_id: org!.id,
    role: 'org_admin',
  })
  if (memErr) throw memErr

  console.log('Seeded org + membership:', org)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

