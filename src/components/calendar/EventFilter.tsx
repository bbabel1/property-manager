"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { CalendarEventFilter, EVENT_COLORS } from '@/types/calendar'

const STORAGE_KEY = 'calendar_event_filters'

interface EventFilterProps {
  filters: CalendarEventFilter
  onChange: (filters: CalendarEventFilter) => void
}

const FILTER_OPTIONS: { key: keyof CalendarEventFilter; label: string; description: string; color: string; group: 'My Calendars' | 'System Calendars' | 'Other Calendars' }[] = [
  { key: 'google', label: 'Google Calendar', description: 'Imported from your connected Google calendar', color: EVENT_COLORS.google, group: 'My Calendars' },
  { key: 'tasks', label: 'Tasks', description: 'ORA tasks and reminders', color: EVENT_COLORS.task, group: 'System Calendars' },
  { key: 'workOrders', label: 'Work Orders', description: 'Maintenance appointments and visits', color: EVENT_COLORS.work_order, group: 'System Calendars' },
  { key: 'transactions', label: 'Transactions', description: 'Billing due dates and payments', color: EVENT_COLORS.transaction, group: 'Other Calendars' },
  { key: 'leases', label: 'Leases', description: 'Lease start/end dates and renewals', color: EVENT_COLORS.lease, group: 'Other Calendars' },
]

export function EventFilter({ filters, onChange }: EventFilterProps) {
  const [localFilters, setLocalFilters] = useState<CalendarEventFilter>(filters)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setLocalFilters(parsed)
        onChange(parsed)
      }
    } catch (error) {
      console.error('Failed to load filters from localStorage:', error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localFilters))
      onChange(localFilters)
    } catch (error) {
      console.error('Failed to save filters to localStorage:', error)
    }
  }, [localFilters, onChange])

  const handleToggle = (key: keyof CalendarEventFilter) => {
    setLocalFilters((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const grouped = FILTER_OPTIONS.reduce<Record<string, typeof FILTER_OPTIONS>>((acc, option) => {
    acc[option.group] = acc[option.group] || []
    acc[option.group].push(option)
    return acc
  }, {})

  return (
    <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:bg-slate-950/80">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Calendars</CardTitle>
        <p className="text-xs text-muted-foreground">Choose which sources appear in your view.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {Object.entries(grouped).map(([group, options]) => (
          <div key={group} className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{group}</p>
            {options.map((option) => (
              <div
                key={option.key}
                className="flex items-center justify-between rounded-lg px-2 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/70"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span
                    aria-hidden
                    className="h-3 w-3 flex-shrink-0 rounded-sm shadow-sm"
                    style={{ backgroundColor: option.color }}
                  />
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">{option.label}</p>
                    <p className="text-xs text-muted-foreground leading-tight">{option.description}</p>
                  </div>
                </div>
                <Switch
                  checked={localFilters[option.key]}
                  onCheckedChange={() => handleToggle(option.key)}
                  className="shrink-0 ml-2"
                />
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
