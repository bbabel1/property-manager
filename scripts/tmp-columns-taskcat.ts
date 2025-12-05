import * as db from '../src/lib/db'
const supabase = (db as any).supabaseAdmin ?? (db as any).supabase
async function main(){
  const {data,error}=await supabase.from('task_categories').select('*').limit(1)
  if(error) throw error
  console.log(Object.keys(data?.[0]||{}))
}
main().catch(e=>{console.error(e);process.exit(1)})
