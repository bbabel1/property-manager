import { config } from 'dotenv'
config({ path: '.env' })

console.log('Environment check:')
console.log('BUILDIUM_BASE_URL:', process.env.BUILDIUM_BASE_URL)
console.log('BUILDIUM_CLIENT_ID:', process.env.BUILDIUM_CLIENT_ID ? '[SET]' : '[MISSING]')
console.log('BUILDIUM_CLIENT_SECRET:', process.env.BUILDIUM_CLIENT_SECRET ? '[SET]' : '[MISSING]')
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '[SET]' : '[MISSING]')
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
