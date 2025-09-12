"use client"

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function FinalizeBar({ reconciliationId, isFinished, canFinalize }: { reconciliationId: string | number, isFinished: boolean, canFinalize: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function finalize() {
    setPending(true)
    await fetch(`/api/buildium/bank-accounts/reconciliations/${reconciliationId}/finalize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    setPending(false)
    router.refresh()
  }

  return (
    <div className="sticky bottom-0 bg-background/60 backdrop-blur border-t p-3 flex items-center justify-end gap-3">
      <button className="border px-3 py-1 rounded text-sm" disabled={isFinished || !canFinalize || pending} onClick={finalize}>
        {pending ? 'Finalizing…' : 'Finalize reconciliation'}
      </button>
    </div>
  )
}

