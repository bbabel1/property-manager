import * as db from '../src/lib/db'
const supabase = (db as any).supabaseAdmin ?? (db as any).supabase
async function main() {
  const { data, error } = await supabase.from('properties').select('*').limit(1)
  if (error) throw error
  console.log(Object.keys(data?.[0] || {}))
}
main().catch(err => { console.error(err); process.exit(1) })
