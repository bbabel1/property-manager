import * as db from '../src/lib/db'
const supabase = (db as any).supabaseAdmin ?? (db as any).supabase
async function main(){
  const {data,error}=await supabase
    .from('task_categories')
    .select('id')
    .eq('buildium_category_id',2153)
    .maybeSingle()
  if(error && error.code !== 'PGRST116') throw error
  console.log(data)
}
main().catch(e=>{console.error(e);process.exit(1)})
