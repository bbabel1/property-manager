import 'dotenv/config'
import { supabaseAdmin } from '../src/lib/db'

const buildingId = '0d4bc5a3-8cf5-4012-b8b4-d02297b0dfdd'

async function main() {
  const { data, error } = await supabaseAdmin
    .from('buildings')
    .select('geoservice, hpd_building, nta')
    .eq('id', buildingId)
    .maybeSingle()
  if (error) throw error
  console.log(JSON.stringify(data, null, 2))
}

main().catch((e) => { console.error(e); process.exit(1) })
