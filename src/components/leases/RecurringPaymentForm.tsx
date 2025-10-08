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
import { RentCycleEnumDb } from '@/schemas/lease-api'

const PaymentSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  payment_method: z.string().min(1, 'Payment method is required'),
  resident_id: z.string().optional(),
  memo: z.string().optional(),
  frequency: RentCycleEnumDb,
  next_date: z.string().min(1, 'Next date required'),
  posting_days_in_advance: z.coerce.number().int(),
  duration: z.enum(['until_end', 'occurrences']),
  occurrences: z.coerce.number().int().nonnegative().optional(),
  allocations: z.array(
    z.object({
      account_id: z.string().min(1, 'Account required'),
      amount: z.coerce.number().nonnegative(),
    })
  ).min(1, 'At least one allocation is required'),
})

type AllocationRow = {
  id: string
  account_id: string
  amount: string
}

type FormState = {
  amount: string
  payment_method: string
  resident_id: string
  memo: string
  frequency: string
  next_date: string | null
  posting_days_in_advance: string
  duration: 'until_end' | 'occurrences'
  occurrences: string
  allocations: AllocationRow[]
}

type FieldErrors = Partial<Record<keyof FormState, string>> & { allocations?: string }

const PAYMENT_METHOD_OPTIONS = [
  { value: 'ach', label: 'ACH' },
  { value: 'check', label: 'Check' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
]

export interface RecurringPaymentFormProps {
  leaseId: string | number
  leaseSummary: {
    propertyUnit?: string | null
    tenants?: string | null
  }
  accounts: LeaseAccountOption[]
  tenants: Array<{ id: string; name: string }>
  onCancel?: () => void
  onSuccess?: () => void
}

export default function RecurringPaymentForm({ leaseId, leaseSummary, accounts, tenants, onCancel, onSuccess }: RecurringPaymentFormProps) {
  const cycleOptions = useMemo(
    () => RentCycleEnumDb.options.map((value) => ({ value, label: value.replace(/([a-z])([A-Z])/g, '$1 $2') })),
    []
  )

  const createId = () => (
    typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  )

  const [form, setForm] = useState<FormState>({
    amount: '',
    payment_method: PAYMENT_METHOD_OPTIONS[0]?.value ?? 'ach',
    resident_id: tenants?.[0]?.id ?? '',
    memo: 'Recurring payment',
    frequency: cycleOptions[0]?.value ?? 'Monthly',
    next_date: null,
    posting_days_in_advance: '0',
    duration: 'until_end',
    occurrences: '',
    allocations: [{ id: createId(), account_id: '', amount: '' }],
  })

  const [errors, setErrors] = useState<FieldErrors>({})
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

  const addAllocation = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      allocations: [...prev.allocations, { id: createId(), account_id: '', amount: '' }],
    }))
  }, [])

  const removeAllocation = useCallback((id: string) => {
    setForm((prev) => ({
      ...prev,
      allocations: prev.allocations.length > 1 ? prev.allocations.filter((row) => row.id !== id) : prev.allocations,
    }))
  }, [])

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setSubmitting(true)
      setFormError(null)

      const allocationsParsed = form.allocations
        .filter((row) => row.account_id)
        .map((row) => ({ account_id: row.account_id, amount: Number(row.amount || '0') }))

      const payload = {
        amount: form.amount,
        payment_method: form.payment_method,
        resident_id: form.resident_id || undefined,
        memo: form.memo,
        frequency: form.frequency,
        next_date: form.next_date ?? '',
        posting_days_in_advance: form.posting_days_in_advance,
        duration: form.duration,
        occurrences: form.duration === 'occurrences' ? form.occurrences : undefined,
        allocations: allocationsParsed,
      }

      const parsed = PaymentSchema.safeParse(payload)
      if (!parsed.success) {
        const fieldErrors: FieldErrors = {}
        for (const issue of parsed.error.issues) {
          const path = issue.path?.[0]
          if (path === 'allocations') {
            fieldErrors.allocations = issue.message
          } else if (typeof path === 'string') {
            fieldErrors[path as keyof FormState] = issue.message
          }
        }
        setErrors(fieldErrors)
        setSubmitting(false)
        return
      }

      const allocationsTotal = allocationsParsed.reduce((sum, row) => sum + (row.amount || 0), 0)
      const amountValue = Number(form.amount || '0')
      if (allocationsTotal !== amountValue) {
        setErrors((prev) => ({ ...prev, allocations: 'Allocated amounts must equal the payment amount' }))
        setSubmitting(false)
        return
      }

      try {
        const res = await fetch(`/api/leases/${leaseId}/recurring-payments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: amountValue,
            payment_method: form.payment_method,
            resident_id: form.resident_id || null,
            memo: form.memo || null,
            frequency: form.frequency,
            next_date: form.next_date,
            posting_days_in_advance: Number(form.posting_days_in_advance || '0'),
            duration: form.duration,
            occurrences: form.duration === 'occurrences' ? Number(form.occurrences || '0') : null,
            allocations: allocationsParsed,
          }),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(typeof body?.error === 'string' ? body.error : 'Failed to create recurring payment')
        }

        setForm({
          amount: '',
          payment_method: PAYMENT_METHOD_OPTIONS[0]?.value ?? 'ach',
          resident_id: tenants?.[0]?.id ?? '',
          memo: 'Recurring payment',
          frequency: cycleOptions[0]?.value ?? 'Monthly',
          next_date: null,
          posting_days_in_advance: '0',
          duration: 'until_end',
          occurrences: '',
          allocations: [{ id: createId(), account_id: '', amount: '' }],
        })
        setErrors({})
        onSuccess?.()
      } catch (error) {
        setFormError(error instanceof Error ? error.message : 'Unexpected error while saving recurring payment')
        setSubmitting(false)
        return
      }

      setSubmitting(false)
    },
    [cycleOptions, form, leaseId, onSuccess, tenants]
  )

  const allocationsTotal = form.allocations.reduce((sum, row) => sum + Number(row.amount || '0'), 0)

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">
          Add recurring payment{leaseSummary?.propertyUnit ? ` for ${leaseSummary.propertyUnit}` : ''}
          {leaseSummary?.tenants ? ` • ${leaseSummary.tenants}` : ''}
        </h1>
        <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <Info className="h-4 w-4 flex-none" />
          <span>Recurring payments can be scheduled to post automatically before or after their due date.</span>
        </div>
      </div>

      <Card className="border border-border/70 shadow-sm">
        <CardContent className="p-8">
          <form className="space-y-10" onSubmit={handleSubmit}>
            <section className="grid gap-6 lg:grid-cols-2">
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
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment method *</span>
                <Dropdown
                  value={form.payment_method}
                  onChange={(value) => updateField('payment_method', value)}
                  options={PAYMENT_METHOD_OPTIONS}
                  placeholder="Select payment method"
                />
                {errors.payment_method ? <p className="text-xs text-destructive">{errors.payment_method}</p> : null}
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Received from</span>
                <Dropdown
                  value={form.resident_id}
                  onChange={(value) => updateField('resident_id', value)}
                  options={(tenants ?? []).map((tenant) => ({ value: tenant.id, label: tenant.name }))}
                  placeholder="Select resident"
                />
              </label>
              <label className="space-y-2 lg:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Memo</span>
                <Textarea
                  rows={3}
                  value={form.memo}
                  onChange={(event) => updateField('memo', event.target.value)}
                  maxLength={200}
                />
              </label>
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Recurrence information</h2>
              <div className="grid gap-6 lg:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Frequency *</span>
                  <Dropdown value={form.frequency} onChange={(value) => updateField('frequency', value)} options={cycleOptions} />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next date *</span>
                  <DatePicker value={form.next_date} onChange={(value) => updateField('next_date', value)} placeholder="YYYY-MM-DD" />
                  {errors.next_date ? <p className="text-xs text-destructive">{errors.next_date}</p> : null}
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Post *</span>
                  <div className="flex items-center gap-2">
                    <Input
                      className="w-20"
                      type="number"
                      inputMode="numeric"
                      value={form.posting_days_in_advance}
                      onChange={(event) => updateField('posting_days_in_advance', event.target.value)}
                    />
                    <span className="text-sm text-muted-foreground">days in advance</span>
                  </div>
                </label>
              </div>

              <div className="space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Duration *</span>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="radio"
                      name="recurring-duration"
                      checked={form.duration === 'until_end'}
                      onChange={() => updateField('duration', 'until_end')}
                      className="h-4 w-4"
                    />
                    Until end of term
                  </label>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="radio"
                      name="recurring-duration"
                      checked={form.duration === 'occurrences'}
                      onChange={() => updateField('duration', 'occurrences')}
                      className="h-4 w-4"
                    />
                    End after
                    <Input
                      className="w-20"
                      type="number"
                      inputMode="numeric"
                      value={form.occurrences}
                      onChange={(event) => updateField('occurrences', event.target.value)}
                      disabled={form.duration !== 'occurrences'}
                    />
                    occurrences
                  </label>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Apply payment to balances</h2>
              <div className="overflow-hidden rounded-lg border border-border">
                <Table className="min-w-full">
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="w-32 text-right">Balance</TableHead>
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
                        <TableCell className="text-right text-sm text-muted-foreground">$0.00</TableCell>
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
                          <Button variant="ghost" size="icon" onClick={() => removeAllocation(row.id)} aria-label="Remove allocation">
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30 font-medium">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">$0.00</TableCell>
                      <TableCell className="text-right text-sm">${allocationsTotal.toFixed(2)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <Button variant="link" className="px-0" type="button" onClick={addAllocation}>
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
                {submitting ? 'Saving…' : 'Save recurring payment'}
              </Button>
              <Button type="button" variant="outline" className="text-muted-foreground" disabled>
                Add another recurring payment
              </Button>
              <Button type="button" variant="ghost" className="text-muted-foreground" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
