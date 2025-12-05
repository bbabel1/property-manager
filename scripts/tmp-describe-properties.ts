import * as db from '../src/lib/db'
const supabase = (db as any).supabaseAdmin ?? (db as any).supabase
async function main() {
  const { data, error } = await supabase.rpc('pg_catalog.col_description', {})
}
main()
