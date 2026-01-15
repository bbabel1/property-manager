import Link from 'next/link'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import InfoCard from '@/components/layout/InfoCard'
import { Body, Heading } from '@/ui/typography'

type BankAccountRow = {
  id: string
  name: string | null
  bank_account_type: string | null
  bank_account_number: string | null
  is_active: boolean | null
}

export default async function BankAccountsIndex() {
  const supabase = await getSupabaseServerClient()
  // Prefer API for masking, but server-side select is fine and fast
  const { data, error } = await supabase
    .from('gl_accounts')
    .select('id, name, bank_account_type, bank_account_number, is_active')
    .eq('is_bank_account', true)
    .order('name', { ascending: true })

  if (error) {
    return (
      <InfoCard title="Bank Accounts">
        <Body as="p" size="sm" className="text-red-600">
          Failed to load bank accounts.
        </Body>
      </InfoCard>
    )
  }

  const mask = (v: string | null) => (v ? v.replace(/.(?=.{4}$)/g, '•') : v)

  return (
    <div className="space-y-6">
      <Heading as="h1" size="h3" className="text-foreground">
        Bank Accounts
      </Heading>
      <div className="rounded-lg border divide-y">
        {(data as BankAccountRow[] | null | undefined)?.map((a) => (
          <div key={a.id} className="p-3 flex items-center justify-between hover:bg-muted/40">
            <div>
              <Body as="div" size="sm" className="font-medium text-foreground">
                {a.name}
              </Body>
              <Body
                as="div"
                size="sm"
                tone="muted"
                className="text-xs capitalize leading-tight"
              >
                {a.bank_account_type || 'account'} • {mask(a.bank_account_number) || '••••'}
              </Body>
            </div>
            <Body as={Link} href={`/bank-accounts/${a.id}`} size="sm" className="text-primary underline">
              View
            </Body>
          </div>
        ))}
        {(!data || data.length === 0) && (
          <Body as="div" size="sm" tone="muted" className="p-3">
            No bank accounts found.
          </Body>
        )}
      </div>
    </div>
  )
}
