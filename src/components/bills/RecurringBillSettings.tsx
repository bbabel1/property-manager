'use client'

import { useState, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { AlertCircle, Info, Pause, Play, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  mapDisplayLabelToFrequency,
  mapFrequencyToDisplayLabel,
  type RecurringBillFrequency,
  type RecurringBillSchedule,
} from '@/types/recurring-bills'

export interface RecurringBillSettingsProps {
  billId: string
  billDate: string
  isRecurring: boolean
  schedule: RecurringBillSchedule | null
  isApproved: boolean
  onUpdate: (updates: {
    is_recurring?: boolean
    recurring_schedule?: RecurringBillSchedule
    recurring_action?: 'pause' | 'resume' | 'disable'
  }) => Promise<void>
}

const FREQUENCY_OPTIONS: Array<{ value: RecurringBillFrequency; displayLabel: string }> = [
  { value: 'Monthly', displayLabel: 'Monthly' },
  { value: 'Weekly', displayLabel: 'Weekly' },
  { value: 'Every2Weeks', displayLabel: 'Biweekly' },
  { value: 'Quarterly', displayLabel: 'Quarterly' },
  { value: 'Yearly', displayLabel: 'Annually' },
]

const DAYS_OF_WEEK = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' },
]

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
]

const ROLLOVER_OPTIONS = [
  { value: 'last_day', label: 'Last day of month' },
  { value: 'next_month', label: 'Next month' },
  { value: 'skip', label: 'Skip' },
]

export function RecurringBillSettings({
  billId,
  billDate,
  isRecurring: initialIsRecurring,
  schedule: initialSchedule,
  isApproved,
  onUpdate,
}: RecurringBillSettingsProps) {
  const [isRecurring, setIsRecurring] = useState(initialIsRecurring)
  const [schedule, setSchedule] = useState<any>(initialSchedule || null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState<'pause' | 'resume' | 'disable' | null>(
    null,
  )

  const frequency = schedule?.frequency || 'Monthly'
  const normalizedDayOfWeek =
    schedule?.day_of_week === 0 ? 7 : schedule?.day_of_week
  const isMonthlyQuarterlyYearly =
    frequency === 'Monthly' || frequency === 'Quarterly' || frequency === 'Yearly'
  const isWeeklyEvery2Weeks = frequency === 'Weekly' || frequency === 'Every2Weeks'
  const jsDayToMondayIndex = useCallback((jsDay: number) => ((jsDay + 6) % 7) + 1, [])

  const handleToggleRecurring = useCallback(async () => {
      if (isApproved) {
        toast.error('Cannot modify recurring settings on approved bills')
        return
      }

      const newIsRecurring = !isRecurring
    setIsRecurring(newIsRecurring)

      if (newIsRecurring) {
        // Initialize default schedule
        const defaultSchedule: Partial<RecurringBillSchedule> = {
          frequency: 'Monthly',
          day_of_month: new Date(billDate).getDate(),
        start_date: billDate,
        status: 'active',
        rollover_policy: 'last_day',
      }
      setSchedule(defaultSchedule)
    } else {
      // Disable recurrence
      setIsSubmitting(true)
      try {
        await onUpdate({ is_recurring: false })
        toast.success('Recurring billing disabled')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to disable recurrence')
        setIsRecurring(true) // Revert
      } finally {
        setIsSubmitting(false)
      }
    }
  }, [isRecurring, isApproved, billDate, onUpdate])

  const handleScheduleChange = useCallback(
    (key: string, value: unknown) => {
      if (isApproved) return

      setSchedule((prev: any) => ({
        ...(prev || {}),
        [key]: value as never,
      }))
    },
    [isApproved],
  )

  const handleSave = useCallback(async () => {
    if (isApproved) {
      toast.error('Cannot modify recurring settings on approved bills')
      return
    }

    if (!isRecurring || !schedule) {
      return
    }

    // Validate required fields
    if (!schedule.start_date) {
      toast.error('Start date is required')
      return
    }

    if (isMonthlyQuarterlyYearly && !schedule.day_of_month) {
      toast.error('Day of month is required')
      return
    }

    if (isWeeklyEvery2Weeks && schedule.day_of_week === undefined) {
      toast.error('Day of week is required')
      return
    }

    if ((frequency === 'Quarterly' || frequency === 'Yearly') && !schedule.month) {
      toast.error('Month is required for quarterly and yearly frequencies')
      return
    }

    setIsSubmitting(true)
    try {
      await onUpdate({
        is_recurring: true,
        recurring_schedule: schedule as RecurringBillSchedule,
      })
      toast.success('Recurring settings saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save recurring settings')
    } finally {
      setIsSubmitting(false)
    }
  }, [isRecurring, schedule, isApproved, isMonthlyQuarterlyYearly, isWeeklyEvery2Weeks, frequency, onUpdate])

  const handleAction = useCallback(
    async (action: 'pause' | 'resume' | 'disable') => {
      if (isApproved) {
        toast.error('Cannot modify recurring settings on approved bills')
        return
      }

      setIsSubmitting(true)
      try {
        await onUpdate({ recurring_action: action })
        if (action === 'pause') {
          setSchedule((prev: any) => (prev ? { ...prev, status: 'paused' } : null))
          toast.success('Recurring billing paused')
        } else if (action === 'resume') {
          setSchedule((prev: any) => (prev ? { ...prev, status: 'active' } : null))
          toast.success('Recurring billing resumed')
        } else {
          setSchedule((prev: any) => (prev ? { ...prev, status: 'ended' } : null))
          setIsRecurring(false)
          toast.success('Recurring billing disabled')
        }
        setShowConfirmDialog(null)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update recurrence')
      } finally {
        setIsSubmitting(false)
      }
    },
    [isApproved, onUpdate],
  )

  if (isApproved && !isRecurring) {
    return null // Don't show recurring settings for non-recurring approved bills
  }

  return (
    <Card className="border-border/70 border shadow-sm">
      <CardContent className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">Recurring Billing</h3>
            <p className="text-muted-foreground text-sm">
              Set up automatic bill generation on a schedule
            </p>
          </div>
          {!isApproved && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">
                {isRecurring ? 'Enabled' : 'Disabled'}
              </span>
              <Button
                type="button"
                variant={isRecurring ? 'default' : 'outline'}
                size="sm"
                onClick={handleToggleRecurring}
                disabled={isSubmitting}
              >
                {isRecurring ? 'Disable' : 'Enable'}
              </Button>
            </div>
          )}
        </div>

        {isRecurring && schedule && (
          <div className="space-y-6">
            {/* Frequency Selection */}
            <div className="space-y-2">
              <label className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                Frequency *
              </label>
              <Select
                value={frequency}
                onValueChange={(value) => {
                  const canonical = mapDisplayLabelToFrequency(value)
                  if (canonical) {
                    handleScheduleChange('frequency', canonical)
                    // Reset conditional fields when frequency changes
                    if (canonical === 'Weekly' || canonical === 'Every2Weeks') {
                      const startDate = schedule.start_date || billDate
                      const jsDay = new Date(startDate + 'T00:00:00Z').getUTCDay()
                      const dayOfWeek = jsDayToMondayIndex(jsDay)
                      handleScheduleChange('day_of_week', dayOfWeek)
                      delete (schedule as any).day_of_month
                      delete (schedule as any).month
                    } else {
                      const dayOfMonth = new Date(billDate).getDate()
                      handleScheduleChange('day_of_month', dayOfMonth)
                      delete (schedule as any).day_of_week
                    }
                  }
                }}
                disabled={isApproved}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.displayLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Local-only warning for Weekly/Every2Weeks */}
              {isWeeklyEvery2Weeks && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <AlertCircle className="h-4 w-4 flex-none mt-0.5" />
                  <span>
                    Weekly and Biweekly recurrence is local-only and will not sync to Buildium.
                  </span>
                </div>
              )}
            </div>

            {/* Conditional Fields: Monthly/Quarterly/Yearly */}
            {isMonthlyQuarterlyYearly && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                    Day of Month *
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={schedule.day_of_month || ''}
                    onChange={(e) =>
                      handleScheduleChange('day_of_month', Number.parseInt(e.target.value, 10))
                    }
                    disabled={isApproved}
                  />
                </div>

                {(frequency === 'Quarterly' || frequency === 'Yearly') && (
                  <div className="space-y-2">
                    <label className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                      Month *
                    </label>
                    <Select
                      value={schedule.month?.toString() || ''}
                      onValueChange={(value) =>
                        handleScheduleChange('month', Number.parseInt(value, 10))
                      }
                      disabled={isApproved}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select month" />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m) => (
                          <SelectItem key={m.value} value={m.value.toString()}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2 sm:col-span-2">
                  <label className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                    Rollover Policy
                  </label>
                  <Select
                    value={('rollover_policy' in schedule ? (schedule as any).rollover_policy : null) || 'last_day'}
                    onValueChange={(value) =>
                      handleScheduleChange('rollover_policy', value)
                    }
                    disabled={isApproved}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLLOVER_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">
                    What to do when the day doesn't exist in a month (e.g., Feb 30)
                  </p>
                </div>
              </div>
            )}

            {/* Conditional Fields: Weekly/Every2Weeks */}
            {isWeeklyEvery2Weeks && (
              <div className="space-y-2">
                <label className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  Day of Week *
                </label>
                <Select
                  value={normalizedDayOfWeek?.toString() || ''}
                  onValueChange={(value) =>
                    handleScheduleChange('day_of_week', Number.parseInt(value, 10))
                  }
                  disabled={isApproved}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((d) => (
                      <SelectItem key={d.value} value={d.value.toString()}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  Billing day is anchored to the start date
                </p>
              </div>
            )}

            {/* Start/End Dates */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  Start Date *
                </label>
                <DatePicker
                  value={schedule.start_date || billDate}
                  onChange={(value) => handleScheduleChange('start_date', value)}
                  disabled={isApproved}
                  minDate={billDate ? new Date(`${billDate}T00:00:00Z`) : undefined}
                />
                <p className="text-muted-foreground text-xs">Date-only (YYYY-MM-DD)</p>
              </div>

              <div className="space-y-2">
                <label className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  End Date (Optional)
                </label>
                <DatePicker
                  value={schedule.end_date || ''}
                  onChange={(value) => handleScheduleChange('end_date', value || null)}
                  disabled={isApproved}
                  minDate={
                    schedule.start_date
                      ? new Date(`${schedule.start_date}T00:00:00Z`)
                      : billDate
                        ? new Date(`${billDate}T00:00:00Z`)
                        : undefined
                  }
                />
                <p className="text-muted-foreground text-xs">Leave blank for ongoing</p>
              </div>
            </div>

            {/* Server-owned fields (read-only) */}
            {schedule.next_run_date && (
              <div className="space-y-2">
                <label className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  Next Billing Date (Computed)
                </label>
                <Input value={schedule.next_run_date} disabled readOnly />
                <p className="text-muted-foreground text-xs">
                  This is automatically computed and cannot be edited
                </p>
              </div>
            )}

            {schedule.last_generated_at && (
              <div className="space-y-2">
                <label className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  Last Generated (Computed)
                </label>
                <Input
                  value={new Date(schedule.last_generated_at).toLocaleString()}
                  disabled
                  readOnly
                />
                <p className="text-muted-foreground text-xs">
                  This is automatically updated and cannot be edited
                </p>
              </div>
            )}

            {/* Action Buttons */}
            {!isApproved && (
              <div className="flex items-center gap-2 pt-4 border-t">
                {schedule.status === 'active' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowConfirmDialog('pause')}
                    disabled={isSubmitting}
                  >
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </Button>
                )}
                {schedule.status === 'paused' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowConfirmDialog('resume')}
                    disabled={isSubmitting}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConfirmDialog('disable')}
                  disabled={isSubmitting}
                >
                  <X className="h-4 w-4 mr-2" />
                  Disable
                </Button>
                <div className="flex-1" />
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save Settings'}
                </Button>
              </div>
            )}

            {/* Confirmation Dialogs */}
            {showConfirmDialog && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <Card className="w-full max-w-md">
                  <CardContent className="p-6 space-y-4">
                    <h3 className="text-lg font-semibold">
                      {showConfirmDialog === 'pause' && 'Pause Recurring Billing?'}
                      {showConfirmDialog === 'resume' && 'Resume Recurring Billing?'}
                      {showConfirmDialog === 'disable' && 'Disable Recurring Billing?'}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {showConfirmDialog === 'pause' &&
                        'This will pause bill generation. You can resume later.'}
                      {showConfirmDialog === 'resume' &&
                        'This will resume bill generation from the next scheduled date.'}
                      {showConfirmDialog === 'disable' &&
                        'This will permanently disable recurring billing. Existing generated bills will remain.'}
                    </p>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowConfirmDialog(null)}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant={showConfirmDialog === 'disable' ? 'destructive' : 'default'}
                        onClick={() => handleAction(showConfirmDialog)}
                        disabled={isSubmitting}
                      >
                        {showConfirmDialog === 'pause' && 'Pause'}
                        {showConfirmDialog === 'resume' && 'Resume'}
                        {showConfirmDialog === 'disable' && 'Disable'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {!isRecurring && !isApproved && (
          <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
            <Info className="h-4 w-4 flex-none mt-0.5" />
            <span>
              Enable recurring billing to automatically generate bills on a schedule. All dates are
              stored as date-only (YYYY-MM-DD) and calculations use your organization's timezone.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
