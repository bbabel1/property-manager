"use client"

import { useCallback, useMemo, useState } from 'react'
import { z } from 'zod'
import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dropdown } from '@/components/ui/Dropdown'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Textarea } from '@/components/ui/textarea'
import type { LeaseAccountOption } from '@/components/leases/types'
import { RentCycleEnumDb } from '@/schemas/lease-api'

const RecurringChargeSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  gl_account_id: z.string().min(1, 'Account required'),
  memo: z.string().optional(),
  frequency: RentCycleEnumDb.default('Monthly'),
  next_date: z.string().min(1, 'Next date required'),
  posting_days_in_advance: z.coerce.number().int().default(0),
  duration: z.enum(['until_end', 'occurrences']).default('until_end'),
  occurrences: z.coerce.number().int().nonnegative().optional(),
})

type RecurringChargeFormState = {
  amount: string
  gl_account_id: string
  memo: string
  frequency: string
  next_date: string | null
  posting_days_in_advance: string
  duration: 'until_end' | 'occurrences'
  occurrences: string
}

type FieldErrors = Partial<Record<keyof RecurringChargeFormState, string>>

export interface RecurringChargeFormProps {
  leaseId: string | number
  leaseSummary: {
    propertyUnit?: string | null
    tenants?: string | null
  }
  onCancel?: () => void
  onSuccess?: () => void
  accounts: LeaseAccountOption[]
}

export function RecurringChargeForm({ leaseId, leaseSummary, onCancel, onSuccess, accounts }: RecurringChargeFormProps) {
  const cycleOptions = useMemo(
    () => RentCycleEnumDb.options.map((value) => ({ value, label: value.replace(/([a-z])([A-Z])/g, '$1 $2') })),
    []
  )

  const [form, setForm] = useState<RecurringChargeFormState>({
    amount: '',
    gl_account_id: '',
    memo: 'Recurring charge',
    frequency: cycleOptions[0]?.value ?? 'Monthly',
    next_date: null,
    posting_days_in_advance: '0',
    duration: 'until_end',
    occurrences: '',
  })
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const update = useCallback(<K extends keyof RecurringChargeFormState>(key: K, value: RecurringChargeFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }, [])

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setSubmitting(true)
      setFormError(null)

      const payload = {
        amount: form.amount,
        gl_account_id: form.gl_account_id,
        memo: form.memo,
        frequency: form.frequency,
        next_date: form.next_date ?? '',
        posting_days_in_advance: form.posting_days_in_advance,
        duration: form.duration,
        occurrences: form.duration === 'occurrences' ? form.occurrences : undefined,
      }

      const parsed = RecurringChargeSchema.safeParse(payload)
      if (!parsed.success) {
        const errs: FieldErrors = {}
        for (const issue of parsed.error.issues) {
          const path = issue.path?.[0]
          if (typeof path === 'string') errs[path as keyof RecurringChargeFormState] = issue.message
        }
        setErrors(errs)
        setSubmitting(false)
        return
      }

      try {
        const res = await fetch(`/api/leases/${leaseId}/recurring-charges`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(typeof body?.error === 'string' ? body.error : 'Failed to create recurring charge')
        }
        setErrors({})
        setForm({
          amount: '',
          gl_account_id: '',
          memo: 'Recurring charge',
          frequency: cycleOptions[0]?.value ?? 'Monthly',
          next_date: null,
          posting_days_in_advance: '0',
          duration: 'until_end',
          occurrences: '',
        })
        onSuccess?.()
      } catch (error) {
        setFormError(error instanceof Error ? error.message : 'Unexpected error while saving recurring charge')
        setSubmitting(false)
        return
      }

      setSubmitting(false)
    },
    [cycleOptions, form, leaseId, onSuccess]
  )

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">
          Add recurring charge{leaseSummary?.propertyUnit ? ` for ${leaseSummary.propertyUnit}` : ''}
          {leaseSummary?.tenants ? ` • ${leaseSummary.tenants}` : ''}
        </h1>
        <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <Info className="h-4 w-4 flex-none" />
          <span>
            Recurring rent charges can also be added from the{' '}
            <a href="#rent" className="text-primary underline underline-offset-2">rent page</a>.
          </span>
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
                  onChange={(event) => update('amount', event.target.value)}
                  placeholder="$0.00"
                />
                {errors.amount ? <p className="text-xs text-destructive">{errors.amount}</p> : null}
              </label>
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account *</span>
                <Dropdown
                  value={form.gl_account_id}
                  onChange={(value) => update('gl_account_id', value)}
                  options={(accounts ?? []).map((acc) => ({ value: String(acc.id), label: acc.name }))}
                  placeholder="Select account"
                />
                {errors.gl_account_id ? <p className="text-xs text-destructive">{errors.gl_account_id}</p> : null}
              </label>
              <label className="space-y-2 lg:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Memo</span>
                <Textarea
                  value={form.memo}
                  onChange={(event) => update('memo', event.target.value)}
                  maxLength={200}
                  rows={3}
                />
              </label>
            </section>

            <section className="space-y-4">
              <h2 className="text-sm font-semibold text-foreground">Recurrence information</h2>
              <div className="grid gap-6 lg:grid-cols-3">
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Frequency *</span>
                  <Dropdown
                    value={form.frequency}
                    onChange={(value) => update('frequency', value)}
                    options={cycleOptions}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next date *</span>
                  <DatePicker
                    value={form.next_date}
                    onChange={(value) => update('next_date', value)}
                    placeholder="YYYY-MM-DD"
                  />
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
                      onChange={(event) => update('posting_days_in_advance', event.target.value)}
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
                      name="duration"
                      checked={form.duration === 'until_end'}
                      onChange={() => update('duration', 'until_end')}
                      className="h-4 w-4"
                    />
                    Until end of term
                  </label>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="radio"
                      name="duration"
                      checked={form.duration === 'occurrences'}
                      onChange={() => update('duration', 'occurrences')}
                      className="h-4 w-4"
                    />
                    End after
                    <Input
                      className="w-20"
                      type="number"
                      inputMode="numeric"
                      value={form.occurrences}
                      onChange={(event) => update('occurrences', event.target.value)}
                      disabled={form.duration !== 'occurrences'}
                    />
                    occurrences
                  </label>
                </div>
              </div>
            </section>

            {formError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {formError}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save recurring charge'}
              </Button>
              <Button type="button" variant="outline" className="text-muted-foreground" disabled>
                Add another recurring charge
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

export default RecurringChargeForm
