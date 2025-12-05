import * as db from '../src/lib/db'
const supabase = (db as any).supabaseAdmin ?? (db as any).supabase
async function main(){
  const now = new Date().toISOString()
  const payload = {
    buildium_category_id: 2153,
    name: 'Compliance',
    is_active: true,
    description: null,
    color: null,
    parent_id: null,
    buildium_subcategory_id: null,
    created_at: now,
    updated_at: now,
  }
  const { error } = await supabase.from('task_categories').insert(payload)
  console.log('error', error)
  const { data } = await supabase.from('task_categories').select('*').eq('buildium_category_id',2153)
  console.log(data)
}
main().catch(e=>{console.error(e);process.exit(1)})
