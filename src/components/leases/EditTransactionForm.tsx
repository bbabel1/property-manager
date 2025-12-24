"use client"

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import EnterChargeForm from '@/components/leases/EnterChargeForm'
import type { LeaseAccountOption } from '@/components/leases/types'
import type { BuildiumLeaseTransaction } from '@/types/buildium'

type LeaseSummary = {
  propertyUnit?: string | null
  tenants?: string | null
}

type ChargeFormValues = {
  date: string | null
  amount: number
  memo?: string | null
  allocations: Array<{ account_id: string; amount: number; memo?: string | null }>
}

type TransactionPayload = {
  id: number
  type: string
  typeLabel: string
  chargeValues?: ChargeFormValues
}

type EditTransactionFormState =
  | { status: 'loading'; initialTypeLabel?: string }
  | { status: 'error'; message: string }
  | { status: 'unsupported'; typeLabel: string }
  | { status: 'ready'; payload: TransactionPayload }

export type EditTransactionFormProps = {
  leaseId: number | string
  transactionId: number
  accountOptions: LeaseAccountOption[]
  leaseSummary: LeaseSummary
  onCancel: () => void
  onSaved: () => void
  initialTypeLabel?: string | null
}

type TransactionLine = {
  GLAccountId?: number | null
  GLAccount?: { Id?: number | null; Name?: string | null } | number | null
  Amount?: number | null
  Memo?: string | null
}

function mapChargeValues(tx: BuildiumLeaseTransaction): ChargeFormValues {
  const lines: TransactionLine[] = Array.isArray(tx?.Lines) && tx.Lines.length
    ? tx.Lines
    : Array.isArray(tx?.Journal?.Lines)
      ? tx.Journal.Lines
      : []

  const allocations = lines
    .map((line) => {
      const glIdRaw = line?.GLAccountId ?? (typeof line?.GLAccount === 'object' ? line.GLAccount?.Id : line?.GLAccount)
      if (!glIdRaw) return null
      return {
        account_id: String(glIdRaw),
        amount: Number(line?.Amount ?? 0),
        memo: line?.Memo ?? undefined,
      }
    })
    .filter(Boolean) as Array<{ account_id: string; amount: number; memo?: string | null }>

  return {
    date: tx?.Date ? String(tx.Date).slice(0, 10) : null,
    amount: Number(tx?.TotalAmount ?? 0) || 0,
    memo: tx?.Memo ?? tx?.Description ?? null,
    allocations,
  }
}

function normalizeType(value: unknown): string {
  if (!value) return 'transaction'
  return String(value).trim() || 'transaction'
}

export default function EditTransactionForm({
  leaseId,
  transactionId,
  accountOptions,
  leaseSummary,
  onCancel,
  onSaved,
  initialTypeLabel,
}: EditTransactionFormProps) {
  const [state, setState] = useState<EditTransactionFormState>({ status: 'loading', initialTypeLabel: initialTypeLabel ?? undefined })
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let isCancelled = false
    const controller = new AbortController()

    async function load() {
      setState({ status: 'loading', initialTypeLabel: initialTypeLabel ?? undefined })
      try {
        const response = await fetch(`/api/leases/${leaseId}/transactions/${transactionId}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error(typeof body?.error === 'string' ? body.error : 'Unable to load transaction')
        }

        const json = await response.json()
        const tx = (json?.data || json) as BuildiumLeaseTransaction | null
        if (!tx) throw new Error('Transaction not found')

        const typeRaw = normalizeType(tx?.TransactionTypeEnum || tx?.TransactionType)
        const typeLabel = (typeRaw.replace(/^Lease\s*/i, '') || 'Transaction').trim() || 'Transaction'
        const typeForComparison = typeRaw.toLowerCase()
        const isCharge = typeForComparison.includes('charge')

        if (!isCharge) {
          if (!isCancelled) setState({ status: 'unsupported', typeLabel })
          return
        }

        const chargeValues = mapChargeValues(tx)
        const payload: TransactionPayload = {
          id: Number(tx?.Id ?? transactionId),
          type: 'charge',
          typeLabel,
          chargeValues,
        }

        if (!isCancelled) {
          setState({ status: 'ready', payload })
        }
      } catch (error) {
        if (isCancelled) return
        const message = error instanceof Error && error.name === 'AbortError'
          ? 'Request was cancelled'
          : error instanceof Error
            ? error.message
            : 'Failed to load transaction'
        setState({ status: 'error', message })
      }
    }

    void load()

    return () => {
      isCancelled = true
      controller.abort()
    }
  }, [leaseId, transactionId, initialTypeLabel, reloadToken])

  const heading = useMemo(() => {
    if (state.status === 'ready') return `Edit ${state.payload.typeLabel.toLowerCase()}`
    if (state.status === 'unsupported') return `View ${state.typeLabel.toLowerCase()}`
    if (state.status === 'loading') return `Loading ${state.initialTypeLabel ? state.initialTypeLabel.toLowerCase() : 'transaction'}`
    return 'Edit transaction'
  }, [state])

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Card className="border border-border/70 shadow-sm">
        <CardContent className="space-y-6 p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Transaction detail</p>
              <h2 className="text-2xl font-semibold capitalize text-foreground">
                {heading}
                {leaseSummary?.propertyUnit ? ` • ${leaseSummary.propertyUnit}` : ''}
                {leaseSummary?.tenants ? ` • ${leaseSummary.tenants}` : ''}
              </h2>
            </div>
            {state.status === 'ready' ? (
              <Badge variant="outline" className="text-xs uppercase tracking-wide">
                {state.payload.typeLabel}
              </Badge>
            ) : state.status === 'unsupported' ? (
              <Badge variant="secondary" className="text-xs uppercase tracking-wide">
                {state.typeLabel}
              </Badge>
            ) : null}
          </div>

          {state.status === 'loading' ? (
            <div className="rounded-md border border-border/60 bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
              Loading transaction details…
            </div>
          ) : null}

          {state.status === 'error' ? (
            <div className="space-y-4">
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {state.message}
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="cancel" onClick={onCancel}>
                  Close
                </Button>
                <Button variant="ghost" onClick={() => setReloadToken((value) => value + 1)}>
                  Retry
                </Button>
              </div>
            </div>
          ) : null}

          {state.status === 'unsupported' ? (
            <div className="space-y-4">
              <div className="rounded-md border border-border/60 bg-muted/40 px-4 py-5 text-sm text-muted-foreground">
                Editing {state.typeLabel.toLowerCase()} transactions is not supported yet. You can manage this entry from Buildium.
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="cancel" onClick={onCancel}>
                  Close
                </Button>
              </div>
            </div>
          ) : null}

          {state.status === 'ready' && state.payload.type === 'charge' ? (
            <EnterChargeForm
              leaseId={leaseId}
              accounts={accountOptions}
              mode="edit"
              transactionId={transactionId}
              initialValues={state.payload.chargeValues}
              layout="embedded"
              onCancel={onCancel}
              onSuccess={onSaved}
              footerRenderer={({ submitting, onCancel: cancelHandler }) => (
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Saving…' : 'Save changes'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={cancelHandler}>
                    Cancel
                  </Button>
                </div>
              )}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
