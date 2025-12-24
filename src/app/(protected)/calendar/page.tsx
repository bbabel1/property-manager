"use client"

import { useState, useEffect, useCallback } from 'react'
import { GoogleCalendarView } from '@/components/calendar/GoogleCalendarView'
import { CalendarEvent, CalendarEventFilter, DEFAULT_EVENT_FILTERS, GoogleCalendarEvent, EVENT_COLORS } from '@/types/calendar'
import {
  endOfMonth,
  startOfMonth,
} from 'date-fns'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function CalendarPage() {
  const [filters, setFilters] = useState<CalendarEventFilter>(DEFAULT_EVENT_FILTERS)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date())

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const monthStart = startOfMonth(currentMonth)
      const monthEnd = endOfMonth(currentMonth)
      const timeMin = monthStart.toISOString()
      const timeMax = monthEnd.toISOString()

      const allEvents: CalendarEvent[] = []

      if (filters.google) {
        try {
          const response = await fetch(
            `/api/calendar/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`
          )
          if (response.ok) {
            const data = await response.json()
            const googleEvents = (data.events || []).map((event: GoogleCalendarEvent) => {
              const start = event.start?.dateTime || event.start?.date
              const end = event.end?.dateTime || event.end?.date
              const allDay = !!event.start?.date

              return {
                id: `google-${event.id}`,
                title: event.summary || 'Untitled Event',
                start: start || new Date().toISOString(),
                end: end || null,
                allDay,
                source: 'google' as const,
                sourceId: event.id,
                color: EVENT_COLORS.google,
                description: event.description,
                location: event.location,
                timezone: event.start?.timeZone,
              } as CalendarEvent
            })
            allEvents.push(...googleEvents)
          }
        } catch (error) {
          console.error('Failed to fetch Google Calendar events:', error)
        }
      }

      const types: string[] = []
      if (filters.tasks) types.push('tasks')
      if (filters.workOrders) types.push('work_orders')
      if (filters.transactions) types.push('transactions')
      if (filters.leases) types.push('leases')

      if (types.length > 0) {
        const response = await fetch(
          `/api/calendar/local-events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&types=${types.join(',')}`
        )
        if (response.ok) {
          const data = await response.json()
          allEvents.push(...(data.events || []))
        } else {
          const errorData = await response.json().catch(() => ({}))
          toast.error('Failed to load events', {
            description: errorData.error?.message || 'Could not fetch local events',
          })
        }
      }

      setEvents(allEvents)
    } catch (error) {
      console.error('Error fetching events:', error)
      toast.error('Failed to load calendar events', {
        description: 'An error occurred while loading events',
      })
    } finally {
      setLoading(false)
    }
  }, [currentMonth, filters])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <GoogleCalendarView
      events={events}
      filters={filters}
      onFiltersChange={setFilters}
      currentMonth={currentMonth}
      onMonthChange={setCurrentMonth}
      onRefreshEvents={fetchEvents}
    />
  )
}
