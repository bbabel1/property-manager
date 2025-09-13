import InfoCard from '@/components/layout/InfoCard'
import Link from 'next/link'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export default async function BankAccountShow({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await getSupabaseServerClient()
  const { data: a, error } = await (supabase as any)
    .from('bank_accounts')
    .select('id, name, description, bank_account_type, account_number, routing_number, gl_account, buildium_bank_id, is_active')
    .eq('id', id)
    .maybeSingle()

  if (error || !a) {
    return (
      <InfoCard title="Bank Account">
        <p className="text-sm text-red-600">Bank account not found.</p>
      </InfoCard>
    )
  }

  const mask = (v: string | null) => (v ? v.replace(/.(?=.{4}$)/g, '•') : v)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">{a.name}</h1>
        <Link href="/bank-accounts" className="text-sm text-primary underline">Back to accounts</Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InfoCard title="Details">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="text-muted-foreground">Type</div>
            <div className="capitalize">{a.bank_account_type || '—'}</div>
            <div className="text-muted-foreground">Account #</div>
            <div>{mask(a.account_number) || '—'}</div>
            <div className="text-muted-foreground">Routing #</div>
            <div>{mask(a.routing_number) || '—'}</div>
            <div className="text-muted-foreground">Buildium ID</div>
            <div>{a.buildium_bank_id ?? '—'}</div>
            <div className="text-muted-foreground">Status</div>
            <div>{a.is_active ? 'Active' : 'Inactive'}</div>
          </div>
        </InfoCard>
        <InfoCard title="Reconciliation">
          <p className="text-sm text-muted-foreground">Use the reconciliation actions here.</p>
          <div className="mt-2 text-sm">
            <Link className="text-primary underline" href={`/api/buildium/bank-accounts/reconciliations?bankAccountId=${a.buildium_bank_id ?? ''}`} target="_blank">List reconciliations (raw)</Link>
          </div>
        </InfoCard>
      </div>
    </div>
  )
}
