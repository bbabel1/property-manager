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
import { Body, Heading, Label } from '@/ui/typography'

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

type RecurringDefaults = Partial<{
  memo: string | null
  posting_day: number | null
  posting_days_in_advance: number | null
  gl_account_id: string | null
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
  rentScheduleId?: number | string | null
  recurringTransactionId?: number | string | null
  rentCycleOptions: string[]
  rentStatusOptions: string[]
  rentAccountOptions?: { value: string; label: string }[]
  onCancel?: () => void
  onSuccess?: () => void
  defaults?: RentScheduleFormDefaults
  recurringDefaults?: RecurringDefaults
  leaseSummary?: RentScheduleFormLeaseSummary
}

export function RentScheduleForm({
  leaseId,
  rentScheduleId,
  recurringTransactionId,
  rentCycleOptions,
  rentStatusOptions,
  rentAccountOptions,
  onCancel,
  onSuccess,
  defaults,
  recurringDefaults,
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
  const [memo, setMemo] = useState<string>(recurringDefaults?.memo ?? '')
  const [postingDay, setPostingDay] = useState<string>(
    recurringDefaults?.posting_day != null ? String(recurringDefaults.posting_day) : ''
  )
  const [postingDaysInAdvance, setPostingDaysInAdvance] = useState<string>(
    recurringDefaults?.posting_days_in_advance != null
      ? String(recurringDefaults.posting_days_in_advance)
      : ''
  )
  const [glAccountId, setGlAccountId] = useState<string>(recurringDefaults?.gl_account_id ?? '')

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
        const isEdit = rentScheduleId != null
        const endpoint = isEdit
          ? `/api/rent-schedules/${rentScheduleId}`
          : `/api/leases/${leaseId}/rent-schedules`

        const res = await fetch(endpoint, {
          method: isEdit ? 'PUT' : 'POST',
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

        // Also update recurring transaction (rent template) when provided
        if (recurringTransactionId) {
          const postingDayNum = postingDay ? Number(postingDay) : null
          const postingOffsetNum = postingDaysInAdvance ? Number(postingDaysInAdvance) : null
          const recurringRes = await fetch(`/api/recurring-transactions/${recurringTransactionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: parsed.data.total_amount,
              memo,
              start_date: parsed.data.start_date,
              end_date: parsed.data.end_date,
              frequency: parsed.data.rent_cycle,
              posting_day: Number.isFinite(postingDayNum) ? postingDayNum : null,
              posting_days_in_advance: Number.isFinite(postingOffsetNum) ? postingOffsetNum : null,
              gl_account_id: glAccountId || null,
            }),
          })
          if (!recurringRes.ok) {
            const payload = await recurringRes.json().catch(() => ({}))
            const message =
              typeof payload?.error === 'string' ? payload.error : 'Failed to update recurring rent'
            setFormError(message)
            setSubmitting(false)
            return
          }
        }

        setFormValues({
          start_date: null,
          end_date: null,
          rent_cycle: cycleDropdown[0]?.value ?? RentCycleEnumDb.options[0],
          total_amount: '',
          status: statusDropdown[0]?.value ?? 'Future',
          backdate_charges: false,
        })
        setMemo('')
        setPostingDay('')
        setPostingDaysInAdvance('')
        setGlAccountId('')
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
    [
      cycleDropdown,
      formValues,
      glAccountId,
      leaseId,
      memo,
      onSuccess,
      postingDay,
      postingDaysInAdvance,
      recurringTransactionId,
      rentScheduleId,
      statusDropdown,
    ]
  )

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <div className="space-y-2">
        <Heading as="h1" size="h3">
          Add rent
        </Heading>
        <Body as="p" size="sm" tone="muted">
          Create a future or historical rent schedule for this lease.
        </Body>
      </div>

      <Card className="border border-border/70 shadow-sm">
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-10">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,2.25fr)_1fr]">
              <div className="space-y-10">
                <section className="space-y-5">
                  <div className="space-y-1">
                    <Heading as="h2" size="h6">
                      When does this rent start?
                    </Heading>
                    <Body as="p" size="sm" tone="muted">
                      Set the start and optional end date for the rent schedule.
                    </Body>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="space-y-2">
                      <Label
                        as="span"
                        size="xs"
                        tone="muted"
                        className="flex items-center gap-1 uppercase tracking-wide"
                      >
                        Start date * <Info className="h-3.5 w-3.5" />
                      </Label>
                      <DatePicker
                        value={formValues.start_date}
                        onChange={(value) => updateField('start_date', value)}
                        placeholder="mm/dd/yyyy"
                      />
                      {errors.start_date ? (
                        <Body as="p" size="xs" className="text-destructive">
                          {errors.start_date}
                        </Body>
                      ) : null}
                    </label>
                    <label className="space-y-2">
                      <Label
                        as="span"
                        size="xs"
                        tone="muted"
                        className="flex items-center gap-1 uppercase tracking-wide"
                      >
                        End date
                        <Info className="h-3.5 w-3.5 text-muted-foreground" />
                      </Label>
                      <DatePicker
                        value={formValues.end_date}
                        onChange={(value) => updateField('end_date', value)}
                        placeholder="mm/dd/yyyy"
                      />
                      {errors.end_date ? (
                        <Body as="p" size="xs" className="text-destructive">
                          {errors.end_date}
                        </Body>
                      ) : null}
                    </label>
                  </div>
                </section>

                <section className="space-y-5">
                  <div className="space-y-1">
                    <Heading as="h2" size="h6">
                      When is rent charged?
                    </Heading>
                    <Body as="p" size="sm" tone="muted">
                      Choose the billing cadence and status for this schedule.
                    </Body>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <label className="space-y-2">
                      <Label
                        as="span"
                        size="xs"
                        tone="muted"
                        className="flex items-center gap-1 uppercase tracking-wide"
                      >
                        Rent cycle *
                        <Info className="h-3.5 w-3.5" />
                      </Label>
                      <Dropdown
                        value={formValues.rent_cycle}
                        onChange={(value) => updateField('rent_cycle', value)}
                        options={cycleDropdown}
                        placeholder="Select cycle"
                      />
                      {errors.rent_cycle ? (
                        <Body as="p" size="xs" className="text-destructive">
                          {errors.rent_cycle}
                        </Body>
                      ) : null}
                    </label>
                    <label className="space-y-2">
                      <Label
                        as="span"
                        size="xs"
                        tone="muted"
                        className="flex items-center gap-1 uppercase tracking-wide"
                      >
                        Status *
                        <Info className="h-3.5 w-3.5" />
                      </Label>
                      <Dropdown
                        value={formValues.status}
                        onChange={(value) => updateField('status', value)}
                        options={statusDropdown}
                        placeholder="Select status"
                      />
                      {errors.status ? (
                        <Body as="p" size="xs" className="text-destructive">
                          {errors.status}
                        </Body>
                      ) : null}
                    </label>
                  </div>
                </section>

                <section className="space-y-5">
                  <div className="space-y-1">
                    <Heading as="h2" size="h6">
                      Charge details
                    </Heading>
                    <Body as="p" size="sm" tone="muted">
                      Provide the amount that should be charged for this schedule.
                    </Body>
                  </div>
                  <div className="space-y-4">
                    <div className="relative overflow-hidden rounded-lg border border-border bg-background shadow-sm">
                      <div className="absolute left-0 top-0 h-full w-1 bg-primary-50" aria-hidden="true" />
                      <div className="grid gap-5 p-6 sm:grid-cols-2">
                        <label className="space-y-2">
                          <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                            Amount *
                          </Label>
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={formValues.total_amount}
                            onChange={(event) => updateField('total_amount', event.target.value)}
                            placeholder="$0.00"
                          />
                          {errors.total_amount ? (
                            <Body as="p" size="xs" className="text-destructive">
                              {errors.total_amount}
                            </Body>
                          ) : null}
                        </label>
                        <div className="flex items-center gap-3 pt-6">
                          <Checkbox
                            id="backdate"
                            checked={formValues.backdate_charges}
                            onCheckedChange={(checked) => updateField('backdate_charges', Boolean(checked))}
                          />
                          <Label htmlFor="backdate">Backdate charges for this schedule</Label>
                        </div>
                        <label className="space-y-2">
                          <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                            Account
                          </Label>
                          <Dropdown
                            value={glAccountId}
                            onChange={(value) => setGlAccountId(String(value))}
                            options={(rentAccountOptions || []).map((opt) => ({
                              value: opt.value,
                              label: opt.label,
                            }))}
                            placeholder="Select account"
                          />
                        </label>
                        <label className="space-y-2 sm:col-span-2">
                          <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                            Memo
                          </Label>
                          <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Rent" />
                        </label>
                        <label className="space-y-2">
                          <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                            Post day
                          </Label>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={31}
                            value={postingDay}
                            onChange={(e) => setPostingDay(e.target.value)}
                            placeholder="1"
                          />
                        </label>
                        <label className="space-y-2">
                          <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                            Days in advance
                          </Label>
                          <Input
                            type="number"
                            inputMode="numeric"
                            value={postingDaysInAdvance}
                            onChange={(e) => setPostingDaysInAdvance(e.target.value)}
                            placeholder="0"
                          />
                        </label>
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

              <aside className="self-start rounded-lg border border-border/60 bg-muted/10 px-6 py-5 shadow-sm">
                <Label as="h4" size="xs" tone="muted" className="mb-4 uppercase tracking-wide">
                  Lease information
                </Label>
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-6">
                    <Label as="span" size="xs" tone="muted" className="uppercase">
                      Lease type
                    </Label>
                    <Label as="span">{leaseSummary?.leaseType || '—'}</Label>
                  </div>
                  <div className="flex items-start justify-between gap-6">
                    <Label as="span" size="xs" tone="muted" className="uppercase">
                      Lease start/end date
                    </Label>
                    <Body as="span" size="sm" className="text-right">
                      {leaseSummary?.leaseRange || '—'}
                    </Body>
                  </div>
                  <div className="flex items-start justify-between gap-6">
                    <Label as="span" size="xs" tone="muted" className="uppercase">
                      Tenants
                    </Label>
                    <Body as="span" size="sm" className="text-right">
                      {leaseSummary?.tenants || '—'}
                    </Body>
                  </div>
                  <div className="flex items-start justify-between gap-6">
                    <Label as="span" size="xs" tone="muted" className="uppercase">
                      Property • Unit
                    </Label>
                    <Body as="span" size="sm" className="text-right">
                      {leaseSummary?.propertyUnit || '—'}
                    </Body>
                  </div>
                  <div className="flex items-start justify-between gap-6">
                    <Label as="span" size="xs" tone="muted" className="uppercase">
                      Current market rent
                    </Label>
                    <Heading as="span" size="h6" className="text-right">
                      {leaseSummary?.currentMarketRent || '—'}
                    </Heading>
                  </div>
                </div>
              </aside>
            </div>

            {formError ? (
              <Body
                as="div"
                size="sm"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive"
              >
                {formError}
              </Body>
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
