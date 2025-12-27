import { getSupabaseServerClient } from '@/lib/supabase/server'
import InfoCard from '@/components/layout/InfoCard'
import ReconciliationHeader from '@/components/reconciliations/ReconciliationHeader'
import BalanceCard from '@/components/reconciliations/BalanceCard'
import ClearingPanel from '@/components/reconciliations/ClearingPanel'
import FinalizeBar from '@/components/reconciliations/FinalizeBar'
import { resolvePropertyIdentifier } from '@/lib/public-id-utils'

type ReconciliationLogRow = {
  property_id: string
  bank_gl_account_id: string | null
  gl_account_id: string | null
  statement_ending_date: string | null
  is_finished: boolean | null
  ending_balance: number | null
  total_checks_withdrawals: number | null
  total_deposits_additions: number | null
}

export default async function ReconciliationPage({ params }: { params: Promise<{ id: string; reconciliationId: string }> }) {
  const { id: slug, reconciliationId } = await params
  const { publicId: propertyPublicId } = await resolvePropertyIdentifier(slug)
  const supabase = await getSupabaseServerClient()

  // Load reconciliation record from our log
  const { data: rlRaw } = await supabase
    .from('reconciliation_log')
    .select('property_id, bank_gl_account_id, gl_account_id, statement_ending_date, is_finished, ending_balance, total_checks_withdrawals, total_deposits_additions')
    .eq('buildium_reconciliation_id', Number(reconciliationId))
    .maybeSingle()
  const rl = rlRaw as ReconciliationLogRow | null

  if (!rl) return (
    <InfoCard title="Reconciliation">
      <p className="text-sm text-muted-foreground">No local reconciliation record found. Try syncing reconciliations.</p>
    </InfoCard>
  )

  // Bank details
  let bankName = 'Bank Account', acctMasked = '••••'
  try {
    const bankGlAccountId = rl.bank_gl_account_id
    if (bankGlAccountId) {
      const { data: ba } = await supabase
        .from('gl_accounts')
        .select('name, bank_account_number')
        .eq('id', bankGlAccountId)
        .maybeSingle<{ name: string | null; bank_account_number: string | null }>()
      if (ba) {
        bankName = ba.name || bankName
        const acct = ba.bank_account_number || ''
        const last4 = acct ? acct.slice(-4) : ''
        acctMasked = last4 ? `•••• ${last4}` : '••••'
      }
    }
  } catch {}

  const statementDate = rl.statement_ending_date || ''

  // Variance for guardrails
  let variance = 0
  if (rl.property_id && rl.gl_account_id && statementDate) {
    const propertyIdValue = String(rl.property_id)
    const glAccountIdValue = String(rl.gl_account_id)
    const { data: varianceRow } = await supabase
      .from('v_reconciliation_variances')
      .select('variance, ledger_balance, buildium_ending_balance')
      .eq('property_id', propertyIdValue)
      .eq('gl_account_id', glAccountIdValue)
      .eq('as_of', statementDate)
      .maybeSingle<{ variance: number | null }>()
    variance = Number(varianceRow?.variance ?? 0)
  }
  const canFinalize = !rl.is_finished && variance === 0

  return (
    <div className="space-y-6">
      <ReconciliationHeader
        bankName={bankName}
        maskedNumber={acctMasked}
        statementDate={statementDate}
        status={rl.is_finished ? 'Finished' : 'Pending'}
        propertyId={propertyPublicId}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <BalanceCard
          reconciliationId={reconciliationId}
          endingBalance={rl.ending_balance}
          totals={{ withdrawals: rl.total_checks_withdrawals, deposits: rl.total_deposits_additions }}
          statementDate={statementDate}
          isFinished={!!rl.is_finished}
        />
        <div className="lg:col-span-2">
          <ClearingPanel reconciliationId={reconciliationId} isFinished={!!rl.is_finished} />
        </div>
      </div>
      <FinalizeBar reconciliationId={reconciliationId} isFinished={!!rl.is_finished} canFinalize={canFinalize} />
    </div>
  )
}
