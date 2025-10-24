"use client"

import { useCallback, useMemo, useState } from 'react'
import { z } from 'zod'
import { Info, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dropdown } from '@/components/ui/Dropdown'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import type { LeaseAccountOption } from '@/components/leases/types'

const IssueCreditSchema = z.object({
  date: z.string().min(1, 'Date required'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  action: z.enum(['waive_charges', 'exchange', 'refund']),
  memo: z.string().optional(),
  allocations: z.array(
    z.object({
      account_id: z.string().min(1, 'Account required'),
      amount: z.number().nonnegative(),
    })
  ).min(1, 'Add at least one account'),
})

type AllocationRow = {
  id: string
  account_id: string
  amount: string
}

type FormState = {
  date: string | null
  amount: string
  action: 'waive_charges' | 'exchange' | 'refund'
  memo: string
  allocations: AllocationRow[]
}

export interface IssueCreditFormProps {
  leaseId: number | string
  leaseSummary: {
    propertyUnit?: string | null
    tenants?: string | null
  }
  accounts: LeaseAccountOption[]
  onCancel?: () => void
  onSuccess?: () => void
}

const ACTION_OPTIONS = [
  { value: 'waive_charges', label: 'Issue credit to waive unpaid charges' },
  { value: 'exchange', label: 'Issue credit in exchange for goods or services or to write-off unpaid charges' },
  { value: 'refund', label: 'Issue credit for payments previously deposited' },
]

export default function IssueCreditForm({ leaseId, leaseSummary, accounts, onCancel, onSuccess }: IssueCreditFormProps) {
  const createId = () => (
    typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  )

  const [form, setForm] = useState<FormState>({
    date: null,
    amount: '',
    action: 'waive_charges',
    memo: 'Credit',
    allocations: [{ id: createId(), account_id: '', amount: '' }],
  })
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>> & { allocations?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }, [])

  const updateAllocation = useCallback((id: string, changes: Partial<AllocationRow>) => {
    setForm((prev) => ({
      ...prev,
      allocations: prev.allocations.map((row) => (row.id === id ? { ...row, ...changes } : row)),
    }))
    setErrors((prev) => ({ ...prev, allocations: undefined }))
  }, [])

  const addRow = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      allocations: [...prev.allocations, { id: createId(), account_id: '', amount: '' }],
    }))
  }, [])

  const removeRow = useCallback((id: string) => {
    setForm((prev) => ({
      ...prev,
      allocations: prev.allocations.length > 1 ? prev.allocations.filter((row) => row.id !== id) : prev.allocations,
    }))
  }, [])

  const allocationsTotal = useMemo(
    () => form.allocations.reduce((sum, row) => sum + Number(row.amount || '0'), 0),
    [form.allocations]
  )

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setSubmitting(true)
      setFormError(null)

      const allocationsParsed = form.allocations
        .filter((row) => row.account_id)
        .map((row) => ({ account_id: row.account_id, amount: Number(row.amount || '0') }))

      const payload = {
        date: form.date ?? '',
        amount: form.amount,
        action: form.action,
        memo: form.memo,
        allocations: allocationsParsed,
      }

      const parsed = IssueCreditSchema.safeParse(payload)
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {}
        for (const issue of parsed.error.issues) {
          const key = issue.path?.[0]
          if (key === 'allocations') fieldErrors.allocations = issue.message
          else if (typeof key === 'string') fieldErrors[key] = issue.message
        }
        setErrors(fieldErrors as any)
        setSubmitting(false)
        return
      }

      const amountValue = Number(form.amount || '0')
      if (allocationsTotal !== amountValue) {
        setErrors((prev) => ({ ...prev, allocations: 'Allocated amounts must equal the credit amount' }))
        setSubmitting(false)
        return
      }

      try {
        const res = await fetch(`/api/leases/${leaseId}/credits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: parsed.data.date,
            amount: amountValue,
            memo: parsed.data.memo || null,
            action: parsed.data.action,
            allocations: allocationsParsed,
          }),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(typeof body?.error === 'string' ? body.error : 'Failed to issue credit')
        }

        setForm({
          date: null,
          amount: '',
          action: 'waive_charges',
          memo: 'Credit',
          allocations: [{ id: createId(), account_id: '', amount: '' }],
        })
        setErrors({})
        onSuccess?.()
      } catch (error) {
        setFormError(error instanceof Error ? error.message : 'Unexpected error while issuing credit')
        setSubmitting(false)
        return
      }

      setSubmitting(false)
    },
    [form, leaseId, onSuccess, allocationsTotal]
  )

  const radioId = (value: string) => `credit-action-${value}`

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">
          Issue credit{leaseSummary?.propertyUnit ? ` for ${leaseSummary.propertyUnit}` : ''}
          {leaseSummary?.tenants ? ` • ${leaseSummary.tenants}` : ''}
        </h1>
        <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <Info className="h-4 w-4 flex-none" />
          <span>Use a credit to offset unpaid charges, exchange services, or refund previous payments.</span>
        </div>
      </div>

      <Card className="border border-border/70 shadow-sm">
        <CardContent className="p-8">
          <form className="space-y-10" onSubmit={handleSubmit}>
            <section className="grid gap-6 lg:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date *</span>
                <DatePicker value={form.date} onChange={(value) => updateField('date', value)} placeholder="YYYY-MM-DD" />
                {errors.date ? <p className="text-xs text-destructive">{errors.date}</p> : null}
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Amount *</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => updateField('amount', event.target.value)}
                  placeholder="$0.00"
                />
                {errors.amount ? <p className="text-xs text-destructive">{errors.amount}</p> : null}
              </label>
            </section>

            <section className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Credit action</span>
              <div className="flex flex-col gap-2">
                {ACTION_OPTIONS.map((option) => (
                  <label key={option.value} htmlFor={radioId(option.value)} className="flex items-start gap-2 text-sm text-foreground">
                    <input
                      id={radioId(option.value)}
                      type="radio"
                      name="credit-action"
                      value={option.value}
                      checked={form.action === option.value}
                      onChange={() => updateField('action', option.value as FormState['action'])}
                      className="mt-1 h-4 w-4"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Memo</span>
                <Textarea
                  rows={3}
                  value={form.memo}
                  onChange={(event) => updateField('memo', event.target.value)}
                  maxLength={200}
                />
              </label>

              <h2 className="text-sm font-semibold text-foreground">Apply credit to balances</h2>
              <div className="overflow-hidden rounded-lg border border-border">
                <Table className="min-w-full">
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="w-32 text-right">Amount</TableHead>
                      <TableHead className="w-12 text-right">Remove</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.allocations.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                        <Dropdown
                          value={row.account_id}
                          onChange={(value) => updateAllocation(row.id, { account_id: value })}
                          options={(accounts ?? []).map((account) => ({ value: String(account.id), label: account.name }))}
                          placeholder="Select account"
                        />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            className="w-28"
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={row.amount}
                            onChange={(event) => updateAllocation(row.id, { amount: event.target.value })}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => removeRow(row.id)} aria-label="Remove allocation">
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30 font-medium">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right text-sm">${allocationsTotal.toFixed(2)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <Button variant="link" className="px-0" type="button" onClick={addRow}>
                <Plus className="h-4 w-4" /> Add row
              </Button>
              {errors.allocations ? <p className="text-xs text-destructive">{errors.allocations}</p> : null}
            </section>

            {formError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {formError}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save credit'}
              </Button>
              <Button type="button" variant="outline" className="text-muted-foreground" disabled>
                Issue another credit
              </Button>
              <Button type="button" variant="cancel" className="text-muted-foreground" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
