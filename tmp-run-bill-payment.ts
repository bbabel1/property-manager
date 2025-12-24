import { resolveBankGlAccountId } from './src/lib/buildium-mappers'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './src/types/database'
import { config } from 'dotenv'
config({ path: '.env' })

const supabase: SupabaseClient<Database> = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
)

async function fetchPayment() {
  const res = await fetch('https://apisandbox.buildium.com/v1/bills/974793/payments/974794', {
    headers: {
      Accept: 'application/json',
      'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID || '',
      'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET || '',
    },
  })
  const body = await res.json()
  return body
}

;(async () => {
  const payment = await fetchPayment()
  const bankGlAccountId = await resolveBankGlAccountId(payment?.BankAccountId ?? null, supabase)
  const totalFromLines = Array.isArray(payment?.Lines)
    ? payment.Lines.reduce(
        (sum: number, line: { Amount?: number | string | null }) =>
          sum + Number(line?.Amount ?? 0),
        0,
      )
    : 0
  console.log({ bankAccountId: payment?.BankAccountId, bankGlAccountId, totalFromLines, paymentAmount: payment?.Amount })
})();
