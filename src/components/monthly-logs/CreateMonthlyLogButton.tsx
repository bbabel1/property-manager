'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Body, Label } from '@/ui/typography'

const MONTH_OPTIONS = [
  { value: '01', label: 'January' },
  { value: '02', label: 'February' },
  { value: '03', label: 'March' },
  { value: '04', label: 'April' },
  { value: '05', label: 'May' },
  { value: '06', label: 'June' },
  { value: '07', label: 'July' },
  { value: '08', label: 'August' },
  { value: '09', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' }
] as const

type CreateMonthlyLogButtonProps = {
  propertyId: string
  unitId: string
  orgId: string
  propertyName?: string | null
  unitLabel?: string | null
}

const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric'
})

function normalizePeriodStart(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const [, year, month] = match
  return `${year}-${month}-01`
}

export default function CreateMonthlyLogButton({
  propertyId,
  unitId,
  orgId,
  propertyName,
  unitLabel
}: CreateMonthlyLogButtonProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const today = useMemo(() => new Date(), [])
  const defaultMonth = useMemo(() => String(today.getUTCMonth() + 1).padStart(2, '0'), [today])
  const defaultYear = useMemo(() => String(today.getUTCFullYear()), [today])
  const yearOptions = useMemo(() => {
    const currentYear = Number(defaultYear)
    const years: string[] = []
    for (let year = currentYear - 5; year <= currentYear + 1; year += 1) {
      years.push(String(year))
    }
    return years
  }, [defaultYear])
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth)
  const [selectedYear, setSelectedYear] = useState(defaultYear)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canCreate = Boolean(propertyId && unitId && orgId)

  const unitDisplayName = useMemo(() => {
    if (unitLabel && unitLabel.trim()) return unitLabel.trim()
    return 'this unit'
  }, [unitLabel])

  const propertyDisplayName = useMemo(() => {
    if (propertyName && propertyName.trim()) return propertyName.trim()
    return 'this property'
  }, [propertyName])

  const resetState = () => {
    setSelectedMonth(defaultMonth)
    setSelectedYear(defaultYear)
    setError(null)
    setIsOpen(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetState()
      return
    }
    if (!canCreate) {
      toast.error('Cannot create monthly log without property, unit, and organization details.')
      return
    }
    setIsOpen(true)
  }

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault()
    if (!canCreate) {
      setError('Missing required identifiers to create a monthly log.')
      return
    }
    if (!selectedMonth || !selectedYear) {
      setError('Select a start month and year to continue.')
      return
    }
    const normalizedStart = normalizePeriodStart(`${selectedYear}-${selectedMonth}-01`)
    if (!normalizedStart) {
      setError('Provide a valid start month and year.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/monthly-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          propertyId,
          unitId,
          periodStart: normalizedStart
        })
      })

      if (!response.ok) {
        let message = 'Failed to create monthly log. Please try again.'
        try {
          const text = await response.text();
          const payload = text ? JSON.parse(text) : {};
          if (payload?.error) message = payload.error;
        } catch {
          // Ignore JSON parse issues; fall back to default message
        }
        throw new Error(message)
      }

      const monthLabel = monthFormatter.format(new Date(`${normalizedStart}T00:00:00`))
      toast.success(`Monthly log for ${monthLabel} has been created.`)
      resetState()
      router.refresh()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Failed to create monthly log.'
      setError(message)
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" disabled={!canCreate || isSubmitting}>
          Create monthly log
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Monthly Log</DialogTitle>
          <DialogDescription>
            Choose the month you want to start tracking activity for {unitDisplayName} at {propertyDisplayName}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <Label size="sm" className="text-foreground">
              Start Month
            </Label>
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col gap-1">
                <Label size="xs" tone="muted" className="uppercase tracking-wide">
                  Month
                </Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label size="xs" tone="muted" className="uppercase tracking-wide">
                  Year
                </Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={year}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Body as="p" size="sm" tone="muted" className="text-xs">
              The monthly log will use the first day of the selected month as the period start.
            </Body>
          </div>
          {error ? (
            <Body as="p" size="sm" className="text-destructive">
              {error}
            </Body>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => resetState()}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create log'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
