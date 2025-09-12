"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function StartContinueReconciliation({
  propertyId,
  bankAccountId,
  buildiumBankAccountId,
  glAccountId,
  lastFinishedDate,
  size = "sm",
  className = "",
}: {
  propertyId: string
  bankAccountId: string | null
  buildiumBankAccountId: number | null
  glAccountId?: string | null
  lastFinishedDate?: string | null
  size?: "sm" | "md"
  className?: string
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const router = useRouter()

  function eom(d: Date) { const dt = new Date(d.getFullYear(), d.getMonth()+1, 0); dt.setHours(0,0,0,0); return dt }
  function addDays(d: Date, n: number) { const dt = new Date(d); dt.setDate(dt.getDate()+n); dt.setHours(0,0,0,0); return dt }
  const defaultDate = (() => {
    if (lastFinishedDate) return addDays(new Date(lastFinishedDate), 1)
    return eom(new Date())
  })()
  const [statementDate, setStatementDate] = useState<string>(defaultDate.toISOString().slice(0,10))

  async function start() {
    if (!buildiumBankAccountId) return alert("No linked Buildium bank account ID.")
    setBusy("start")
    try {
      // Validate no overlap with last finished
      if (lastFinishedDate && statementDate <= lastFinishedDate) {
        alert(`Statement date must be after last finished (${new Date(lastFinishedDate).toLocaleDateString()}).`)
        setBusy(null)
        return
      }
      const res = await fetch('/api/buildium/bank-accounts/reconciliations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ BankAccountId: buildiumBankAccountId, StatementEndingDate: statementDate })
      })
      if (!res.ok) throw new Error(`Create failed: ${res.status}`)
      const json = await res.json()
      const id = json?.data?.Id ?? json?.data?.id
      if (!id) throw new Error('Missing reconciliation Id from Buildium response')
      router.push(`/reconciliations/${id}`)
    } catch (e: any) {
      console.error(e)
      alert(e?.message || 'Failed to start reconciliation')
    } finally {
      setBusy(null)
    }
  }

  async function cont() {
    if (!propertyId || !bankAccountId) return alert("Missing property or bank account.")
    setBusy("continue")
    try {
      // Query latest pending reconciliation for this bank account
      const res = await fetch(`/api/reconciliations/pending?propertyId=${propertyId}&bankAccountId=${bankAccountId}`, { cache: 'no-store' })
      const json = await res.json()
      const id = json?.data?.buildium_reconciliation_id
      if (!id) {
        alert('No pending reconciliation found for this account')
      } else {
        router.push(`/reconciliations/${id}`)
      }
    } catch (e: any) {
      console.error(e)
      alert(e?.message || 'Failed to continue reconciliation')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <input type="date" value={statementDate} onChange={(e)=> setStatementDate(e.target.value)} className="border rounded px-2 py-1 text-sm" />
      <button onClick={start} disabled={busy !== null} className={`border px-2 py-1 rounded text-sm ${busy==='start'?'opacity-60':''}`}>Start</button>
      <button onClick={cont} disabled={busy !== null} className={`border px-2 py-1 rounded text-sm ${busy==='continue'?'opacity-60':''}`}>Continue</button>
    </div>
  )
}
