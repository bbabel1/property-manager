"use client"

import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { ArrowRight } from 'lucide-react'
import ActionButton from '@/components/ui/ActionButton'
import ReceivePaymentForm from '@/components/leases/ReceivePaymentForm'
import EnterChargeForm from '@/components/leases/EnterChargeForm'
import IssueCreditForm from '@/components/leases/IssueCreditForm'
import IssueRefundForm from '@/components/leases/IssueRefundForm'
import WithholdDepositForm from '@/components/leases/WithholdDepositForm'
import EditTransactionForm from '@/components/leases/EditTransactionForm'
import type { LeaseAccountOption } from '@/components/leases/types'

type LedgerRow = {
  id: string
  date: string
  invoice: string
  account: string
  type: string
  memo: string | null
  displayAmount: string
  balance: string
  transactionId?: string | number
}

type LeaseLedgerPanelProps = {
  leaseId: number | string
  rows: LedgerRow[]
  ledgerMatchesLabel: string
  balances: {
    balance: number
    prepayments: number
    depositsHeld: number
  }
  tenantOptions: Array<{ id: string; name: string }>
  accountOptions: LeaseAccountOption[]
  leaseSummary: {
    propertyUnit?: string | null
    tenants?: string | null
  }
  errorMessage?: string | null
  bankAccountOptions: Array<{ id: string; name: string }>
}

export default function LeaseLedgerPanel({
  leaseId,
  rows,
  ledgerMatchesLabel,
  balances,
  tenantOptions,
  accountOptions,
  leaseSummary,
  errorMessage,
  bankAccountOptions,
}: LeaseLedgerPanelProps) {
  const router = useRouter()
  const [mode, setMode] = useState<'none' | 'payment' | 'charge' | 'credit' | 'refund' | 'deposit' | 'edit'>('none')
  const [overlayTop, setOverlayTop] = useState(0)
  const [overlayLeft, setOverlayLeft] = useState(0)
  const [editingTransaction, setEditingTransaction] = useState<{ id: number; typeLabel?: string | null } | null>(null)

  const overlayActive = mode !== 'none'

  useLayoutEffect(() => {
    if (!overlayActive) return
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
  }, [overlayActive])

  useEffect(() => {
    if (!overlayActive) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [overlayActive])

  const cards = useMemo(
    () => [
      { label: 'Current balance', value: balances.balance },
      { label: 'Prepayments', value: balances.prepayments },
      { label: 'Deposits held', value: balances.depositsHeld },
    ],
    [balances]
  )

  const closeOverlay = () => {
    setMode('none')
    setEditingTransaction(null)
  }

  const renderOverlayContent = () => {
    switch (mode) {
      case 'payment':
        return (
          <ReceivePaymentForm
            leaseId={leaseId}
            leaseSummary={leaseSummary}
            accounts={accountOptions}
            tenants={tenantOptions}
            onCancel={closeOverlay}
            onSuccess={() => {
              closeOverlay()
              router.refresh()
            }}
          />
        )
      case 'charge':
        return (
          <EnterChargeForm
            leaseId={leaseId}
            leaseSummary={leaseSummary}
            accounts={accountOptions}
            onCancel={closeOverlay}
            onSuccess={() => {
              closeOverlay()
              router.refresh()
            }}
          />
        )
      case 'credit':
        return (
          <IssueCreditForm
            leaseId={leaseId}
            leaseSummary={leaseSummary}
            accounts={accountOptions}
            onCancel={closeOverlay}
            onSuccess={() => {
              closeOverlay()
              router.refresh()
            }}
          />
        )
      case 'refund':
        return (
          <IssueRefundForm
            leaseId={leaseId}
            leaseSummary={leaseSummary}
            bankAccounts={bankAccountOptions}
            accounts={accountOptions}
            parties={tenantOptions}
            onCancel={closeOverlay}
            onSuccess={() => {
              closeOverlay()
              router.refresh()
            }}
          />
        )
      case 'deposit':
        return (
          <WithholdDepositForm
            leaseId={leaseId}
            leaseSummary={leaseSummary}
            accounts={accountOptions}
            onCancel={closeOverlay}
            onSuccess={() => {
              closeOverlay()
              router.refresh()
            }}
          />
        )
      case 'edit':
        if (!editingTransaction) {
          closeOverlay()
          return null
        }
        return (
          <EditTransactionForm
            leaseId={leaseId}
            transactionId={editingTransaction.id}
            accountOptions={accountOptions}
            leaseSummary={leaseSummary}
            initialTypeLabel={editingTransaction.typeLabel}
            onCancel={closeOverlay}
            onSaved={() => {
              closeOverlay()
              router.refresh()
            }}
          />
        )
      default:
        return null
    }
  }

  if (overlayActive) {
    return (
      <div
        className="fixed bottom-0 z-40 overflow-auto bg-background px-6 pb-12"
        style={{ 
          top: `${Math.max(overlayTop, 0)}px`, 
          left: `${Math.max(overlayLeft, 0)}px`, 
          right: 0 
        }}
      >
        {renderOverlayContent()}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
          {cards.map((card) => (
            <div key={card.label} className="rounded-lg border border-border bg-card px-5 py-4">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.label}</div>
              <div className="mt-1 text-2xl font-semibold text-foreground">${card.value.toFixed(2)}</div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setMode('payment')}>Receive payment</Button>
          <Button variant="outline" onClick={() => setMode('charge')}>Enter charge</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ActionButton />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[14rem]">
              <DropdownMenuItem className="cursor-pointer" onSelect={() => setMode('credit')}>
                Issue credit
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onSelect={() => setMode('refund')}>
                Issue refund
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onSelect={() => setMode('deposit')}>
                Withhold deposit
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" disabled>
                Remove late fees
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="text-sm text-muted-foreground lg:hidden">{ledgerMatchesLabel}</div>
      <div className="flex items-center justify-end gap-2 text-sm text-primary">
        <Button variant="link" className="px-0" disabled>
          Export
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <Table className="min-w-full divide-y divide-border">
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead className="w-24">Date</TableHead>
              <TableHead className="w-24">Invoice</TableHead>
              <TableHead className="w-40">Account</TableHead>
              <TableHead className="min-w-0 flex-1">Transaction</TableHead>
              <TableHead className="w-24 text-right">Amount</TableHead>
              <TableHead className="w-24 text-right">Balance</TableHead>
              <TableHead className="w-12 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border bg-card">
            {errorMessage ? (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-sm text-destructive">
                  {errorMessage}
                </TableCell>
              </TableRow>
            ) : rows.length ? (
              rows.map((row) => {
                const typeLabel = typeof row.type === 'string' ? row.type : ''
                const canEdit = typeLabel.toLowerCase().includes('charge')
                const transactionIdRaw = row.transactionId ? Number(row.transactionId) : Number(row.id)
                return (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm text-foreground">{row.date}</TableCell>
                    <TableCell className="text-sm text-primary">{row.invoice}</TableCell>
                    <TableCell className="text-sm text-foreground">{row.account}</TableCell>
                    <TableCell className="min-w-0">
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium">{row.type}</span>
                          {row.memo ? <span className="text-xs text-muted-foreground">{row.memo}</span> : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm text-foreground">{row.displayAmount}</TableCell>
                    <TableCell className="text-right text-sm text-foreground">{row.balance}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <ActionButton aria-label="Ledger actions" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[12rem]" side="bottom" sideOffset={6}>
                          <DropdownMenuItem
                            className="cursor-pointer text-destructive"
                            onSelect={async () => {
                              const isBuildiumId = row.transactionId != null && Number.isFinite(Number(row.transactionId))
                              const txParam = isBuildiumId ? String(row.transactionId) : String(row.id)
                              const confirmed = typeof window !== 'undefined' ? window.confirm('Delete this transaction? This cannot be undone.') : true
                              if (!confirmed) return
                              try {
                                const res = await fetch(`/api/leases/${leaseId}/transactions/${encodeURIComponent(txParam)}`, { method: 'DELETE' })
                                if (!res.ok && res.status !== 204) {
                                  const body = await res.json().catch(() => ({}))
                                  throw new Error(body?.error || 'Failed to delete transaction')
                                }
                                router.refresh()
                              } catch (e) {
                                 
                                alert(e instanceof Error ? e.message : 'Failed to delete transaction')
                              }
                            }}
                          >
                            Delete
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="cursor-pointer"
                            disabled={!canEdit || !Number.isFinite(transactionIdRaw)}
                            title={!canEdit ? 'Only charge transactions can be edited here.' : undefined}
                            onSelect={() => {
                              if (!canEdit || !Number.isFinite(transactionIdRaw)) return
                              setEditingTransaction({ id: Number(transactionIdRaw), typeLabel })
                              setMode('edit')
                            }}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer" disabled>
                            Prepare invoice
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                  No transactions recorded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
