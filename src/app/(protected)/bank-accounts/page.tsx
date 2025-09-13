import Link from 'next/link'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import InfoCard from '@/components/layout/InfoCard'

export default async function BankAccountsIndex() {
  const supabase = await getSupabaseServerClient()
  // Prefer API for masking, but server-side select is fine and fast
  const { data, error } = await (supabase as any)
    .from('bank_accounts')
    .select('id, name, bank_account_type, account_number, is_active')
    .order('name', { ascending: true })

  if (error) {
    return (
      <InfoCard title="Bank Accounts">
        <p className="text-sm text-red-600">Failed to load bank accounts.</p>
      </InfoCard>
    )
  }

  const mask = (v: string | null) => (v ? v.replace(/.(?=.{4}$)/g, '•') : v)

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Bank Accounts</h1>
      <div className="rounded-lg border divide-y">
        {(data || []).map((a: any) => (
          <div key={a.id} className="p-3 flex items-center justify-between hover:bg-muted/40">
            <div>
              <div className="text-sm font-medium text-foreground">{a.name}</div>
              <div className="text-xs text-muted-foreground capitalize">{a.bank_account_type || 'account'} • {mask(a.account_number) || '••••'}</div>
            </div>
            <Link className="text-primary text-sm underline" href={`/bank-accounts/${a.id}`}>View</Link>
          </div>
        ))}
        {(!data || data.length === 0) && (
          <div className="p-3 text-sm text-muted-foreground">No bank accounts found.</div>
        )}
      </div>
    </div>
  )
}
