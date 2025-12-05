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
  { name: 'LeaseTransaction.*' },
  { name: 'Lease.*' },
  { name: 'LeaseTenant.*' },
  { name: 'MoveOut.*' },
]

export default function DeveloperConsolePage() {
  const [states, setStates] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      } catch (e: any) {
        setError(e?.message || 'Failed to load settings')
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
    <div className="p-6 space-y-6 max-w-5xl">
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
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow className="border-border/60 bg-muted/30">
                  <TableHead className="text-xs font-semibold uppercase tracking-wide px-4 py-3">
                    Event name
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide px-4 py-3">
                    Status
                  </TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide px-4 py-3">
                    Toggle
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-border/60 divide-y">
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : WEBHOOK_EVENTS.map((evt, idx) => {
                  const active = states[evt.name]
                  return (
                    <TableRow key={evt.name} className={idx % 2 === 1 ? 'bg-muted/10' : undefined}>
                      <TableCell className="px-4 py-3 font-medium text-foreground">{evt.name}</TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">
                        {active ? 'Active' : 'Inactive'}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <Switch checked={active} onCheckedChange={() => toggle(evt.name)} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-muted-foreground px-4 py-3 text-xs">
            Note: toggles are client-side only right now—wire them to saved settings and webhook processing guards to actually enable/disable handlers.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
