"use client"

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { fmtCurrency } from './ReconHelpers'

export default function ClearingPanel({
  reconciliationId,
  isFinished,
}: {
  reconciliationId: string | number
  isFinished: boolean
}) {
  const router = useRouter()
  const [rows, setRows] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<(string|number)[]>([])
  const [isPending, startTransition] = useTransition()

  async function load() {
    const res = await fetch(`/api/buildium/bank-accounts/reconciliations/${reconciliationId}/transactions`, { cache: 'no-store' })
    const json = await res.json()
    setRows(Array.isArray(json?.data) ? json.data : [])
  }
  useEffect(() => { load() }, [reconciliationId])

  function toggle(id: string|number, checked: boolean) {
    setSelectedIds(prev => checked ? [...new Set([...prev, id])] : prev.filter(x => x !== id))
  }

  async function act(path: 'clear-transactions'|'unclear-transactions') {
    await fetch(`/api/buildium/bank-accounts/reconciliations/${reconciliationId}/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ TransactionIds: selectedIds })
    })
    startTransition(() => router.refresh())
    await load()
    setSelectedIds([])
  }

  return (
    <div className="rounded-2xl border">
      <div className="p-3 flex items-center justify-between">
        <div className="text-sm font-medium">Clearing</div>
        <div className="flex gap-2">
          <button disabled={!selectedIds.length || isPending || isFinished} onClick={() => act('clear-transactions')} className="border px-3 py-1 rounded text-sm">Clear</button>
          <button disabled={!selectedIds.length || isPending || isFinished} onClick={() => act('unclear-transactions')} className="border px-3 py-1 rounded text-sm">Unclear</button>
        </div>
      </div>
      <div className="max-h-[60vh] overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Date</th>
              <th className="text-left p-2">Memo</th>
              <th className="text-right p-2">Amount</th>
              <th className="text-center p-2">Cleared?</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => {
              const id = r?.Id ?? r?.id
              const date = r?.Date ?? r?.date
              const memo = r?.Memo ?? r?.memo ?? ''
              const amount = Number(r?.Amount ?? r?.amount ?? 0)
              const cleared = Boolean(r?.IsCleared ?? r?.isCleared ?? false)
              return (
                <tr key={String(id)} className="border-b hover:bg-muted/40">
                  <td className="p-2">{date ? new Date(date).toLocaleDateString() : '—'}</td>
                  <td className="p-2">{memo}</td>
                  <td className="p-2 text-right">{fmtCurrency(amount)}</td>
                  <td className="p-2 text-center">
                    <input type="checkbox" defaultChecked={cleared} onChange={e=> toggle(id, e.target.checked)} disabled={isFinished} aria-label={`Mark transaction as ${cleared ? 'uncleared' : 'cleared'}`} />
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

