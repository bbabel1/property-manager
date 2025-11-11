"use client"

import { useCallback, useMemo, useState } from 'react'
import { z } from 'zod'
import { Plus, Info } from 'lucide-react'
import { RentCycleEnumDb, RentScheduleStatusEnumDb } from '@/schemas/lease-api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import { Dropdown } from '@/components/ui/Dropdown'
import { Checkbox } from '@/components/ui/checkbox'

const RentScheduleFormSchema = z.object({
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().nullable().optional(),
  rent_cycle: RentCycleEnumDb.default('Monthly'),
  total_amount: z.coerce.number().positive('Amount must be greater than 0'),
  status: RentScheduleStatusEnumDb.default('Future'),
  backdate_charges: z.boolean().optional().default(false),
})

type FormState = {
  start_date: string | null
  end_date: string | null
  rent_cycle: string
  total_amount: string
  status: string
  backdate_charges: boolean
}

type FieldErrors = Partial<Record<keyof FormState, string>>

export type RentScheduleFormDefaults = Partial<{
  start_date: string | null
  end_date: string | null
  rent_cycle: string | null
  total_amount: number | null
  status: string | null
}>

export interface RentScheduleFormLeaseSummary {
  leaseType?: string | null
  leaseRange?: string | null
  tenants?: string | null
  propertyUnit?: string | null
  currentMarketRent?: string | null
}

interface RentScheduleFormProps {
  leaseId: number | string
  rentCycleOptions: string[]
  rentStatusOptions: string[]
  onCancel?: () => void
  onSuccess?: () => void
  defaults?: RentScheduleFormDefaults
  leaseSummary?: RentScheduleFormLeaseSummary
}

export function RentScheduleForm({
  leaseId,
  rentCycleOptions,
  rentStatusOptions,
  onCancel,
  onSuccess,
  defaults,
  leaseSummary,
}: RentScheduleFormProps) {
  const resolvedCycleOptions = rentCycleOptions.length ? rentCycleOptions : RentCycleEnumDb.options
  const resolvedStatusOptions = rentStatusOptions.length ? rentStatusOptions : RentScheduleStatusEnumDb.options

  const cycleDropdown = useMemo(
    () => resolvedCycleOptions.map((value) => ({ value, label: value.replace(/([a-z])([A-Z])/g, '$1 $2') })),
    [resolvedCycleOptions]
  )
  const statusDropdown = useMemo(
    () => resolvedStatusOptions.map((value) => ({ value, label: value })),
    [resolvedStatusOptions]
  )

  const initialCycle = defaults?.rent_cycle ?? cycleDropdown[0]?.value ?? RentCycleEnumDb.options[0]
  const initialStatus = defaults?.status ?? statusDropdown.find((item) => item.value === 'Future')?.value ?? statusDropdown[0]?.value ?? 'Future'

  const [formValues, setFormValues] = useState<FormState>(() => ({
    start_date: defaults?.start_date ?? null,
    end_date: defaults?.end_date ?? null,
    rent_cycle: initialCycle,
    total_amount: defaults?.total_amount != null ? String(defaults.total_amount) : '',
    status: initialStatus,
    backdate_charges: false,
  }))
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setFormValues((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }, [])

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setSubmitting(true)
      setFormError(null)

      const submission = {
        start_date: formValues.start_date ?? '',
        end_date: formValues.end_date || null,
        rent_cycle: formValues.rent_cycle,
        total_amount: formValues.total_amount,
        status: formValues.status,
        backdate_charges: formValues.backdate_charges,
      }

      const parsed = RentScheduleFormSchema.safeParse(submission)

      if (!parsed.success) {
        const fieldIssues: FieldErrors = {}
        for (const issue of parsed.error.issues) {
          const pathKey = issue.path?.[0]
          if (typeof pathKey === 'string') {
            fieldIssues[pathKey as keyof FormState] = issue.message
          }
        }
        setErrors(fieldIssues)
        setSubmitting(false)
        return
      }

      try {
        const res = await fetch(`/api/leases/${leaseId}/rent-schedules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data),
        })

        if (!res.ok) {
          const payload = await res.json().catch(() => ({}))
          const message = typeof payload?.error === 'string' ? payload.error : 'Failed to create rent schedule'
          setFormError(message)
          setSubmitting(false)
          return
        }

        setFormValues({
          start_date: null,
          end_date: null,
          rent_cycle: cycleDropdown[0]?.value ?? RentCycleEnumDb.options[0],
          total_amount: '',
          status: statusDropdown[0]?.value ?? 'Future',
          backdate_charges: false,
        })
        setErrors({})
        onSuccess?.()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error while saving rent schedule'
        setFormError(message)
        setSubmitting(false)
        return
      }

      setSubmitting(false)
    },
    [defaults?.rent_cycle, formValues, leaseId, onSuccess]
  )

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Add rent</h1>
        <p className="text-sm text-muted-foreground">Create a future or historical rent schedule for this lease.</p>
      </div>

      <Card className="border border-border/70 shadow-sm">
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-10">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,2.25fr)_1fr]">
              <div className="space-y-10">
                <section className="space-y-5">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold text-foreground">When does this rent start?</h2>
                    <p className="text-sm text-muted-foreground">Set the start and optional end date for the rent schedule.</p>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Start date *
                        <Info className="h-3.5 w-3.5" />
                      </span>
                      <DatePicker
                        value={formValues.start_date}
                        onChange={(value) => updateField('start_date', value)}
                        placeholder="mm/dd/yyyy"
                      />
                      {errors.start_date ? <p className="text-xs text-destructive">{errors.start_date}</p> : null}
                    </label>
                    <label className="space-y-2">
                      <span className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        End date
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </span>
                      <DatePicker
                        value={formValues.end_date}
                        onChange={(value) => updateField('end_date', value)}
                        placeholder="mm/dd/yyyy"
                      />
                      {errors.end_date ? <p className="text-xs text-destructive">{errors.end_date}</p> : null}
                    </label>
                  </div>
                </section>

                <section className="space-y-5">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold text-foreground">When is rent charged?</h2>
                    <p className="text-sm text-muted-foreground">Choose the billing cadence and status for this schedule.</p>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Rent cycle *
                        <Info className="h-3.5 w-3.5" />
                      </span>
                      <Dropdown
                        value={formValues.rent_cycle}
                        onChange={(value) => updateField('rent_cycle', value)}
                        options={cycleDropdown}
                        placeholder="Select cycle"
                      />
                      {errors.rent_cycle ? <p className="text-xs text-destructive">{errors.rent_cycle}</p> : null}
                    </label>
                    <label className="space-y-2">
                      <span className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Status *
                        <Info className="h-3.5 w-3.5" />
                      </span>
                      <Dropdown
                        value={formValues.status}
                        onChange={(value) => updateField('status', value)}
                        options={statusDropdown}
                        placeholder="Select status"
                      />
                      {errors.status ? <p className="text-xs text-destructive">{errors.status}</p> : null}
                    </label>
                  </div>
                </section>

                <section className="space-y-5">
                  <div className="space-y-1">
                    <h2 className="text-base font-semibold text-foreground">Charge details</h2>
                    <p className="text-sm text-muted-foreground">Provide the amount that should be charged for this schedule.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="relative overflow-hidden rounded-lg border border-border bg-background shadow-sm">
                      <div className="absolute left-0 top-0 h-full w-1 bg-[var(--color-action-50)]0" aria-hidden="true" />
                      <div className="grid gap-5 p-6 sm:grid-cols-2">
                        <label className="space-y-2">
                          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Amount *</span>
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={formValues.total_amount}
                            onChange={(event) => updateField('total_amount', event.target.value)}
                            placeholder="$0.00"
                          />
                          {errors.total_amount ? <p className="text-xs text-destructive">{errors.total_amount}</p> : null}
                        </label>
                        <div className="flex items-center gap-3 pt-6 text-sm">
                          <Checkbox
                            id="backdate"
                            checked={formValues.backdate_charges}
                            onCheckedChange={(checked) => updateField('backdate_charges', Boolean(checked))}
                          />
                          <label htmlFor="backdate" className="text-sm text-foreground">
                            Backdate charges for this schedule
                          </label>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 text-sm font-medium text-primary opacity-60"
                      disabled
                    >
                      <Plus className="h-4 w-4" />
                      Split rent charge
                    </button>
                  </div>
                </section>
              </div>

              <aside className="self-start rounded-lg border border-border/60 bg-muted/10 px-6 py-5 text-sm shadow-sm">
                <h4 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lease information</h4>
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-6">
                    <span className="text-xs uppercase text-muted-foreground">Lease type</span>
                    <span className="font-medium text-foreground">{leaseSummary?.leaseType || '—'}</span>
                  </div>
                  <div className="flex items-start justify-between gap-6">
                    <span className="text-xs uppercase text-muted-foreground">Lease start/end date</span>
                    <span className="text-right text-foreground">{leaseSummary?.leaseRange || '—'}</span>
                  </div>
                  <div className="flex items-start justify-between gap-6">
                    <span className="text-xs uppercase text-muted-foreground">Tenants</span>
                    <span className="text-right text-foreground">{leaseSummary?.tenants || '—'}</span>
                  </div>
                  <div className="flex items-start justify-between gap-6">
                    <span className="text-xs uppercase text-muted-foreground">Property • Unit</span>
                    <span className="text-right text-foreground">{leaseSummary?.propertyUnit || '—'}</span>
                  </div>
                  <div className="flex items-start justify-between gap-6">
                    <span className="text-xs uppercase text-muted-foreground">Current market rent</span>
                    <span className="text-right font-semibold text-foreground">{leaseSummary?.currentMarketRent || '—'}</span>
                  </div>
                </div>
              </aside>
            </div>

            {formError ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {formError}
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving…' : 'Save'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => onCancel?.()}
                disabled={submitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default RentScheduleForm
