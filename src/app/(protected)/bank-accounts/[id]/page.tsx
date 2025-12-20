import InfoCard from '@/components/layout/InfoCard'
import Link from 'next/link'
import { getSupabaseServerClient } from '@/lib/supabase/server'

type BankAccountDetail = {
  id: string
  name: string | null
  description: string | null
  bank_account_type: string | null
  bank_account_number: string | null
  bank_routing_number: string | null
  buildium_bank_account_id?: number | null
  buildium_gl_account_id?: number | null
  is_active: boolean | null
}

export default async function BankAccountShow({ params }: { params: { id: string } }) {
  const { id } = params
  const supabase = await getSupabaseServerClient()
  const { data: a, error } = await supabase
    .from('gl_accounts')
    .select('id, name, description, bank_account_type, bank_account_number, bank_routing_number, buildium_bank_account_id, buildium_gl_account_id, is_active')
    .eq('id', id)
    .eq('is_bank_account', true)
    .maybeSingle<BankAccountDetail>()

  if (error || !a) {
    return (
      <InfoCard title="Bank Account">
        <p className="text-sm text-red-600">Bank account not found.</p>
      </InfoCard>
    )
  }

  const mask = (v: string | null) => (v ? v.replace(/.(?=.{4}$)/g, '•') : v)
  const buildiumId = a.buildium_gl_account_id ?? a.buildium_bank_account_id ?? null

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
            <div>{mask(a.bank_account_number) || '—'}</div>
            <div className="text-muted-foreground">Routing #</div>
            <div>{mask(a.bank_routing_number) || '—'}</div>
            <div className="text-muted-foreground">Buildium ID</div>
            <div>{buildiumId ?? '—'}</div>
            <div className="text-muted-foreground">Status</div>
            <div>{a.is_active ? 'Active' : 'Inactive'}</div>
          </div>
        </InfoCard>
        <InfoCard title="Reconciliation">
          <p className="text-sm text-muted-foreground">Use the reconciliation actions here.</p>
          <div className="mt-2 text-sm">
            <Link className="text-primary underline" href={`/api/buildium/bank-accounts/reconciliations?bankAccountId=${buildiumId ?? ''}`} target="_blank">List reconciliations (raw)</Link>
          </div>
        </InfoCard>
      </div>
    </div>
  )
}
