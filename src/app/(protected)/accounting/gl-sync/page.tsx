"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'

type SyncResult = Record<string, unknown> | null

export default function GLSyncPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const [result, setResult] = useState<SyncResult>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(kind: 'accounts' | 'entries') {
    setLoading(kind)
    setError(null)
    setResult(null)
    try {
      if (kind === 'accounts') {
        const { buildiumEdgeClient } = await import('@/lib/buildium-edge-client')
        const res = await buildiumEdgeClient.syncGLAccountsFromBuildium({})
        if (!res.success) throw new Error(res.error || 'Failed')
        setResult(res.data)
      } else {
        const { buildiumEdgeClient } = await import('@/lib/buildium-edge-client')
        const res = await buildiumEdgeClient.syncGLEntriesFromBuildium({ overlapDays: 7 })
        if (!res.success) throw new Error(res.error || 'Failed')
        setResult(res.data)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-foreground">General Ledger Sync</h1>

      <div className="space-x-2">
        <Button disabled={loading !== null} onClick={() => run('accounts')}>
          {loading === 'accounts' ? 'Syncing Accounts…' : 'Sync GL Accounts'}
        </Button>

        <Button disabled={loading !== null} onClick={() => run('entries')} className="bg-success text-success-foreground hover:bg-success/90">
          {loading === 'entries' ? 'Syncing Entries…' : 'Sync GL Entries'}
        </Button>
      </div>

      {error && (
        <div className="text-destructive">Error: {error}</div>
      )}

      {result && (
        <pre className="bg-muted p-4 rounded text-sm overflow-auto max-h-96">{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  )
}
