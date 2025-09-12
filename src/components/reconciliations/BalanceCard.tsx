"use client"

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
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
    <div className="rounded-2xl border p-4 space-y-3">
      <h3 className="font-semibold text-foreground">Statement balance</h3>
      <div className="space-y-2">
        <label className="block text-xs text-muted-foreground">Ending Balance</label>
        <input type="number" step="0.01" value={ending} onChange={e=>setEnding(e.target.value)} disabled={isFinished}
               className="w-full border rounded px-2 py-1" />
        <label className="block text-xs text-muted-foreground">Total Checks & Withdrawals</label>
        <input type="number" step="0.01" value={withdrawals} onChange={e=>setWithdrawals(e.target.value)} disabled={isFinished}
               className="w-full border rounded px-2 py-1" />
        <label className="block text-xs text-muted-foreground">Total Deposits & Additions</label>
        <input type="number" step="0.01" value={deposits} onChange={e=>setDeposits(e.target.value)} disabled={isFinished}
               className="w-full border rounded px-2 py-1" />
      </div>
      <div className="text-xs text-muted-foreground">
        Current: {fmtCurrency(endingBalance)} • W: {fmtCurrency(totals?.withdrawals || 0)} • D: {fmtCurrency(totals?.deposits || 0)}
      </div>
      <button onClick={onSave} disabled={isFinished || isPending} className="border px-3 py-1 rounded text-sm w-full">
        {isPending ? 'Saving…' : 'Update balance'}
      </button>
    </div>
  )
}

