import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function listTables() {
  const { data, error } = await supabaseAdmin
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .order('table_name')
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log('Public tables:', data.map(t => t.table_name).join(', '))
}

listTables()
