import * as db from '../src/lib/db'
const supabase = (db as any).supabaseAdmin ?? (db as any).supabase

async function fetchCat(){
  const res = await fetch(`${process.env.BUILDIUM_BASE_URL || 'https://apisandbox.buildium.com/v1'}/tasks/categories/2153`,{
    headers:{Accept:'application/json','x-buildium-client-id':process.env.BUILDIUM_CLIENT_ID!,'x-buildium-client-secret':process.env.BUILDIUM_CLIENT_SECRET!}
  })
  if(!res.ok) throw new Error('fetch failed '+res.status)
  return res.json()
}

async function main(){
  const cat = await fetchCat()
  const now = new Date().toISOString()
  const payload:any = {
    buildium_category_id: cat?.Id ?? null,
    name: cat?.Name ?? null,
    is_active: true,
    description: null,
    color: null,
    parent_id: null,
    buildium_subcategory_id: null,
    updated_at: now,
    created_at: now,
  }
  const { data, error } = await supabase
    .from('task_categories')
    .upsert(payload, { onConflict: 'buildium_category_id' })
    .select('id, name, updated_at')
    .single()
  if(error) throw error
  console.log(data)
}

main().catch(err=>{console.error(err);process.exit(1)})
