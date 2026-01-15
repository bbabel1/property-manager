"use client"

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fmtCurrency } from './ReconHelpers'

export default function BalanceCard({
  reconciliationId,
  endingBalance,
  totals,
  statementDate,
  isFinished,
}: {
  reconciliationId: string | number
  endingBalance: number | null
  totals: { withdrawals: number | null; deposits: number | null } | null
  statementDate: string
  isFinished: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [ending, setEnding] = useState<string>(endingBalance != null ? String(endingBalance) : '')
  const [withdrawals, setWithdrawals] = useState<string>(totals?.withdrawals != null ? String(totals.withdrawals) : '')
  const [deposits, setDeposits] = useState<string>(totals?.deposits != null ? String(totals.deposits) : '')

  async function onSave() {
    await fetch(`/api/buildium/bank-accounts/reconciliations/${reconciliationId}/balance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        StatementEndingDate: statementDate,
        EndingBalance: Number(ending || 0),
        TotalChecksAndWithdrawals: Number(withdrawals || 0),
        TotalDepositsAndAdditions: Number(deposits || 0),
      })
    })
    startTransition(() => router.refresh())
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
      <h3 className="font-semibold text-foreground">Statement balance</h3>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="ending-balance" size="xs" tone="muted">
            Ending balance
          </Label>
          <Input
            id="ending-balance"
            type="number"
            step="0.01"
            value={ending}
            onChange={(e) => setEnding(e.target.value)}
            disabled={isFinished}
            className="h-10"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="withdrawals" size="xs" tone="muted">
            Total checks &amp; withdrawals
          </Label>
          <Input
            id="withdrawals"
            type="number"
            step="0.01"
            value={withdrawals}
            onChange={(e) => setWithdrawals(e.target.value)}
            disabled={isFinished}
            className="h-10"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="deposits" size="xs" tone="muted">
            Total deposits &amp; additions
          </Label>
          <Input
            id="deposits"
            type="number"
            step="0.01"
            value={deposits}
            onChange={(e) => setDeposits(e.target.value)}
            disabled={isFinished}
            className="h-10"
          />
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        Current: {fmtCurrency(endingBalance)} • W: {fmtCurrency(totals?.withdrawals || 0)} • D: {fmtCurrency(totals?.deposits || 0)}
      </div>
      <Button onClick={onSave} disabled={isFinished || isPending} className="w-full">
        {isPending ? 'Saving…' : 'Update balance'}
      </Button>
    </div>
  )
}
