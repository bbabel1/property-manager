"use client"

import { useEffect, useLayoutEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MoreHorizontal, Plus } from 'lucide-react'
import ActionButton from '@/components/ui/ActionButton'
import DynamicOverlay from '@/components/ui/DynamicOverlay'
import RecurringChargeForm from '@/components/leases/RecurringChargeForm'
import RecurringPaymentForm from '@/components/leases/RecurringPaymentForm'
import type { LeaseAccountOption } from '@/components/leases/types'

type RecurringRow = {
  id: string
  nextDate: string
  type: string
  account: string
  memo: string
  frequency: string
  duration: string
  posting: string
  amount: string
}

type Props = {
  leaseId: number | string
  rows: RecurringRow[]
  accounts: LeaseAccountOption[]
  leaseSummary: {
    propertyUnit?: string | null
    tenants?: string | null
  }
  tenants: Array<{ id: string; name: string }>
}

export default function RecurringTransactionsPanel({ leaseId, rows, accounts, leaseSummary, tenants }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<'none' | 'charge' | 'payment'>('none')
  const [overlayTop, setOverlayTop] = useState(0)
  const [overlayLeft, setOverlayLeft] = useState(0)

  useLayoutEffect(() => {
    if (mode === 'none') return
    const update = () => {
      const anchor = document.querySelector('[data-lease-back-link]')
      if (anchor instanceof HTMLElement) {
        const rect = anchor.getBoundingClientRect()
        setOverlayTop(rect.bottom)
        anchor.style.visibility = 'hidden'
      } else {
        setOverlayTop(0)
      }

      const sidebarContainer = document.querySelector('[data-slot="sidebar-container"]') as HTMLElement | null
      const sidebarGap = document.querySelector('[data-slot="sidebar-gap"]') as HTMLElement | null
      const sidebarRect = sidebarContainer?.getBoundingClientRect() || sidebarGap?.getBoundingClientRect()
      setOverlayLeft(sidebarRect ? sidebarRect.right : 0)
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, { passive: true })
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update)
      const anchor = document.querySelector('[data-lease-back-link]') as HTMLElement | null
      if (anchor) anchor.style.visibility = ''
    }
  }, [mode])

  useEffect(() => {
    if (mode === 'none') return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [mode])

  if (mode === 'charge' || mode === 'payment') {
    return (
      <DynamicOverlay overlayTop={overlayTop} overlayLeft={overlayLeft}>
        {mode === 'charge' ? (
          <RecurringChargeForm
            leaseId={leaseId}
            leaseSummary={leaseSummary}
            accounts={accounts}
            onCancel={() => setMode('none')}
            onSuccess={() => {
              setMode('none')
              router.refresh()
            }}
          />
        ) : (
          <RecurringPaymentForm
            leaseId={leaseId}
            leaseSummary={leaseSummary}
            accounts={accounts}
            tenants={tenants}
            onCancel={() => setMode('none')}
            onSuccess={() => {
              setMode('none')
              router.refresh()
            }}
          />
        )}
      </DynamicOverlay>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Recurring transactions</h3>
          <p className="text-sm text-muted-foreground">Manage scheduled charges, payments, and credits for this lease.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="default" className="gap-2" onClick={() => setMode('charge')}>
            <Plus className="h-4 w-4" />
            Add recurring charge
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setMode('payment')}>
            Add recurring payment
          </Button>
          <Button variant="outline" className="gap-2" disabled>
            Add recurring credit
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-3 text-sm text-muted-foreground">
          <span>{rows.length ? `${rows.length} match${rows.length === 1 ? '' : 'es'}` : 'No matches'}</span>
          <Button variant="ghost" size="sm" className="h-8" disabled>
            Export
          </Button>
        </div>
        <Table className="min-w-full divide-y divide-border">
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-32">Next date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Memo</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Posting day</TableHead>
              <TableHead className="w-32 text-right">Amount</TableHead>
              <TableHead className="w-12 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border">
            {rows.length ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-sm text-foreground">{row.nextDate}</TableCell>
                  <TableCell className="text-sm text-foreground">{row.type}</TableCell>
                  <TableCell className="text-sm text-foreground">{row.account}</TableCell>
                  <TableCell className="text-sm text-foreground">{row.memo}</TableCell>
                  <TableCell className="text-sm text-foreground">{row.frequency}</TableCell>
                  <TableCell className="text-sm text-foreground">{row.duration}</TableCell>
                  <TableCell className="text-sm text-foreground">{row.posting}</TableCell>
                  <TableCell className="text-right text-sm font-medium text-foreground">{row.amount}</TableCell>
                  <TableCell className="text-right">
                    <ActionButton aria-label="Recurring transaction actions" />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                  No recurring transactions have been set up yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-muted-foreground">
        Recurring transactions with crossed-out next dates will not post because they fall after the end of the current term.
      </p>
    </div>
  )
}
