import { getSupabaseServerClient } from '@/lib/supabase/server'
import InfoCard from '@/components/layout/InfoCard'
import ReconciliationHeader from '@/components/reconciliations/ReconciliationHeader'
import BalanceCard from '@/components/reconciliations/BalanceCard'
import ClearingPanel from '@/components/reconciliations/ClearingPanel'
import FinalizeBar from '@/components/reconciliations/FinalizeBar'

export default async function ReconciliationPage({ params }: { params: Promise<{ id: string; reconciliationId: string }> }) {
  const { id: propertyId, reconciliationId } = await params
  const supabase = await getSupabaseServerClient()

  // Load reconciliation record from our log
  const { data: rl } = await (supabase as any)
    .from('reconciliation_log')
    .select('property_id, bank_gl_account_id, gl_account_id, statement_ending_date, is_finished, ending_balance, total_checks_withdrawals, total_deposits_additions')
    .eq('buildium_reconciliation_id', Number(reconciliationId))
    .maybeSingle()

  if (!rl) return (
    <InfoCard title="Reconciliation">
      <p className="text-sm text-muted-foreground">No local reconciliation record found. Try syncing reconciliations.</p>
    </InfoCard>
  )

  // Bank details
  let bankName = 'Bank Account', acctMasked = '••••'
  try {
    const { data: ba } = await (supabase as any)
      .from('gl_accounts')
      .select('name, bank_account_number')
      .eq('id', rl.bank_gl_account_id)
      .maybeSingle()
    if (ba) {
      bankName = ba.name || bankName
      const acct = (ba as any).bank_account_number || ''
      const last4 = acct ? acct.slice(-4) : ''
      acctMasked = last4 ? `•••• ${last4}` : '••••'
    }
  } catch {}

  const asOf = rl.statement_ending_date

  // Variance for guardrails
  const { data: varianceRow } = await (supabase as any)
    .from('v_reconciliation_variances')
    .select('variance, ledger_balance, buildium_ending_balance')
    .eq('property_id', rl.property_id)
    .eq('gl_account_id', rl.gl_account_id)
    .eq('as_of', asOf)
    .maybeSingle()
  const variance = Number(varianceRow?.variance ?? 0)
  const canFinalize = !rl.is_finished && variance === 0

  return (
    <div className="space-y-6">
      <ReconciliationHeader
        bankName={bankName}
        maskedNumber={acctMasked}
        statementDate={asOf}
        status={rl.is_finished ? 'Finished' : 'Pending'}
        propertyId={propertyId}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <BalanceCard
          reconciliationId={reconciliationId}
          endingBalance={rl.ending_balance}
          totals={{ withdrawals: rl.total_checks_withdrawals, deposits: rl.total_deposits_additions }}
          statementDate={asOf}
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
