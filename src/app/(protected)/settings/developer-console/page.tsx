"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'

type WebhookRow = {
  name: string
  initialActive?: boolean
}

const WEBHOOK_EVENTS: WebhookRow[] = [
  { name: 'Bill.Created' },
  { name: 'Bill.Updated' },
  { name: 'Bill.Deleted' },
  { name: 'Bill.Payment.Created' },
  { name: 'Bill.Payment.Updated' },
  { name: 'Bill.Payment.Deleted' },
  { name: 'GLAccount.Created' },
  { name: 'GLAccount.Updated' },
  { name: 'GLAccount.Deleted' },
  { name: 'Rental.Updated' },
  { name: 'RentalUnit.Updated' },
  { name: 'TaskCategory.Created' },
  { name: 'TaskCategory.Updated' },
  { name: 'TaskCategory.Deleted' },
  { name: 'Task.Created' },
  { name: 'LeaseTransaction.*' },
  { name: 'Lease.*' },
  { name: 'LeaseTenant.*' },
  { name: 'MoveOut.*' },
]

export default function DeveloperConsolePage() {
  const [states, setStates] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tableError, setTableError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/webhooks/settings')
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'Failed to load webhook settings')
        const incoming = (data.events || []) as { event_type?: string; enabled?: boolean }[]
        const merged = WEBHOOK_EVENTS.reduce((acc, item) => {
          const row = incoming.find((r) => r.event_type === item.name)
          acc[item.name] = row?.enabled ?? item.initialActive ?? true
          return acc
        }, {} as Record<string, boolean>)
        setStates(merged)
        setTableError(null)
      } catch (e: any) {
        setError(e?.message || 'Failed to load settings')
        setTableError(e?.message || 'Failed to load settings')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const toggle = (name: string) => {
    const next = !states[name]
    setStates((prev) => ({ ...prev, [name]: next }))
    fetch('/api/webhooks/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: name, enabled: next }),
    }).catch(() => {
      setError('Failed to save toggle')
    })
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">Developer Console</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/settings">Back to Settings</Link>
          </Button>
          <Button>Webhooks</Button>
        </div>
      </div>

      {error && <div className="text-destructive text-sm">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle>Buildium Webhook Events</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative overflow-x-auto">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow className="border-border/60 bg-muted/30">
                  <TableHead className="text-xs font-semibold uppercase tracking-wide px-4 py-3">
                    Event name
                  </TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide px-4 py-3">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-border/60 divide-y">
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={2} className="px-4 py-6 text-center text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : tableError ? (
                  <TableRow>
                    <TableCell colSpan={2} className="px-4 py-6 text-center text-destructive">
                      {tableError}
                    </TableCell>
                  </TableRow>
                ) : WEBHOOK_EVENTS.map((evt, idx) => {
                  const active = states[evt.name]
                  return (
                    <TableRow key={evt.name} className={idx % 2 === 1 ? 'bg-muted/10' : undefined}>
                      <TableCell className="px-4 py-3 font-medium text-foreground">{evt.name}</TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-muted-foreground">Off</span>
                          <Switch checked={active} onCheckedChange={() => toggle(evt.name)} />
                          <span className="text-xs text-muted-foreground">On</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
