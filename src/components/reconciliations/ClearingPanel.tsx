"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'
import { fmtCurrency } from './ReconHelpers'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

type ReconRow = {
  reconciliation_id: string
  transaction_id: string
  bank_gl_account_id: string
  bank_amount: number | null
  bank_posting_type: string | null
  entry_date: string | null
  memo?: string | null
  status: 'uncleared' | 'cleared' | 'reconciled'
  cleared_at: string | null
  reconciled_at: string | null
}

export default function ClearingPanel({
  reconciliationId,
  isFinished,
}: {
  reconciliationId: string | number
  isFinished: boolean
}) {
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const [rows, setRows] = useState<ReconRow[]>([])
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('v_reconciliation_transactions')
      .select(
        'reconciliation_id, transaction_id, bank_gl_account_id, bank_amount, bank_posting_type, entry_date, memo, status, cleared_at, reconciled_at',
      )
      .eq('reconciliation_id', reconciliationId)
      .order('entry_date', { ascending: true })

    if (error) {
      console.error('Failed to load reconciliation transactions', error)
      return
    }
    setRows((data || []) as ReconRow[])
    setSelectedKeys(new Set())
  }, [reconciliationId, supabase])

  useEffect(() => {
    void load()
  }, [load, reconciliationId])

  const selectedCount = selectedKeys.size

  function toggle(key: string, checked: boolean) {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }

  async function updateStatus(nextStatus: 'cleared' | 'uncleared') {
    const updates = rows.filter((r) => selectedKeys.has(`${r.transaction_id}:${r.bank_gl_account_id}`))
    if (!updates.length) return
    const timestamp = new Date().toISOString()

    await Promise.all(
      updates.map((row) =>
        supabase
          .from('bank_register_state')
          .update({
            status: nextStatus,
            current_reconciliation_log_id: nextStatus === 'uncleared' ? null : reconciliationId,
            cleared_at: nextStatus === 'uncleared' ? null : timestamp,
            reconciled_at: nextStatus === 'uncleared' ? null : row.reconciled_at,
          })
          .eq('transaction_id', row.transaction_id)
          .eq('bank_gl_account_id', row.bank_gl_account_id),
      ),
    )

    startTransition(() => router.refresh())
    await load()
  }

  const summary = useMemo(() => {
    const cleared = rows.filter((r) => r.status === 'cleared').length
    const reconciled = rows.filter((r) => r.status === 'reconciled').length
    const uncleared = rows.length - cleared - reconciled
    return { cleared, reconciled, uncleared }
  }, [rows])

  return (
    <div className="rounded-2xl border">
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span>Clearing</span>
          {isFinished ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-semibold">
              <Lock className="h-3 w-3" aria-hidden />
              Locked
            </span>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            disabled={!selectedCount || isPending || isFinished}
            onClick={() => updateStatus('cleared')}
            className="rounded border px-3 py-1 text-sm disabled:opacity-60"
          >
            Clear
          </button>
          <button
            disabled={!selectedCount || isPending || isFinished}
            onClick={() => updateStatus('uncleared')}
            className="rounded border px-3 py-1 text-sm disabled:opacity-60"
          >
            Unclear
          </button>
        </div>
      </div>
      <div className="border-t px-3 py-2 text-xs text-muted-foreground">
        {summary.cleared} cleared · {summary.reconciled} reconciled · {summary.uncleared} uncleared
      </div>
      <div className="max-h-[60vh] overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left">Date</th>
              <th className="p-2 text-left">Memo</th>
              <th className="p-2 text-right">Amount</th>
              <th className="p-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const key = `${r.transaction_id}:${r.bank_gl_account_id}`
              const date = r.entry_date
                ? new Date(r.entry_date).toLocaleDateString()
                : '—'
              const statusLabel = r.status === 'reconciled' ? 'Reconciled' : r.status === 'cleared' ? 'Cleared' : 'Uncleared'
              return (
                <tr key={key} className="border-b hover:bg-muted/40">
                  <td className="p-2">{date}</td>
                  <td className="p-2">{r.memo || '—'}</td>
                  <td className="p-2 text-right">{fmtCurrency(Number(r.bank_amount ?? 0))}</td>
                  <td className="p-2 text-center">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={r.status !== 'uncleared'}
                        onChange={(e) => toggle(key, e.target.checked)}
                        disabled={isFinished}
                        aria-label={`Mark transaction as ${r.status === 'uncleared' ? 'cleared' : 'uncleared'}`}
                      />
                      <span>{statusLabel}</span>
                    </label>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
