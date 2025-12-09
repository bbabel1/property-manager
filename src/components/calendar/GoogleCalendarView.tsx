"use client"

import React, { useState } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { MonthGrid } from './MonthGrid'
import { WeekGrid } from './WeekGrid'
import { DayGrid } from './DayGrid'
import { CalendarEvent, CalendarEventFilter, DEFAULT_EVENT_FILTERS } from '@/types/calendar'
import { addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, startOfMonth, startOfWeek, startOfDay } from 'date-fns'
import { EventDetailDrawer } from './EventDetailDrawer'
import { AddEventModal } from './AddEventModal'
import { toast } from 'sonner'

export type CalendarView = 'month' | 'week' | 'day'

type CalendarInfo = {
  id: string
  name: string
  color: string
  checked: boolean
}

type GoogleCalendarViewProps = {
  events: CalendarEvent[]
  onEventClick?: (event: CalendarEvent) => void
  filters: CalendarEventFilter
  onFiltersChange: (filters: CalendarEventFilter) => void
  currentMonth: Date
  onMonthChange: (month: Date) => void
  onRefreshEvents?: () => void
}

export function GoogleCalendarView({
  events,
  onEventClick,
  filters,
  onFiltersChange,
  currentMonth,
  onMonthChange,
  onRefreshEvents,
}: GoogleCalendarViewProps) {
  const [view, setView] = useState<CalendarView>('month')
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  // Mock calendars - in real app, these would come from props or API
  const [calendars, setCalendars] = useState<CalendarInfo[]>([
    { id: 'google', name: 'Google Calendar', color: '#1a73e8', checked: filters.google },
    { id: 'tasks', name: 'Tasks', color: '#f4b400', checked: filters.tasks },
    { id: 'work_orders', name: 'Work Orders', color: '#0d9488', checked: filters.workOrders },
    { id: 'transactions', name: 'Transactions', color: '#188038', checked: filters.transactions },
    { id: 'leases', name: 'Leases', color: '#9c27b0', checked: filters.leases },
  ])

  const handlePrev = () => {
    if (view === 'month') {
      onMonthChange(startOfMonth(subMonths(currentMonth, 1)))
    } else if (view === 'week') {
      onMonthChange(startOfWeek(subWeeks(currentMonth, 1), { weekStartsOn: 0 }))
    } else if (view === 'day') {
      onMonthChange(startOfDay(subDays(currentMonth, 1)))
    }
  }

  const handleNext = () => {
    if (view === 'month') {
      onMonthChange(startOfMonth(addMonths(currentMonth, 1)))
    } else if (view === 'week') {
      onMonthChange(startOfWeek(addWeeks(currentMonth, 1), { weekStartsOn: 0 }))
    } else if (view === 'day') {
      onMonthChange(startOfDay(addDays(currentMonth, 1)))
    }
  }

  const handleToday = () => {
    const today = new Date()
    if (view === 'month') {
      onMonthChange(startOfMonth(today))
    } else if (view === 'week') {
      onMonthChange(startOfWeek(today, { weekStartsOn: 0 }))
    } else if (view === 'day') {
      onMonthChange(startOfDay(today))
    }
    setSelectedDate(today)
  }

  const handleCalendarToggle = (id: string) => {
    setCalendars(
      calendars.map((cal) =>
        cal.id === id
          ? {
              ...cal,
              checked: !cal.checked,
            }
          : cal,
      ),
    )
    
    // Update filters
    const updatedCal = calendars.find(c => c.id === id)
    if (updatedCal) {
      const newFilters = { ...filters }
      if (id === 'google') newFilters.google = !updatedCal.checked
      if (id === 'tasks') newFilters.tasks = !updatedCal.checked
      if (id === 'work_orders') newFilters.workOrders = !updatedCal.checked
      if (id === 'transactions') newFilters.transactions = !updatedCal.checked
      if (id === 'leases') newFilters.leases = !updatedCal.checked
      onFiltersChange(newFilters)
    }
  }

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setDrawerOpen(true)
    onEventClick?.(event)
  }

  const handleEdit = (event: CalendarEvent) => {
    setDrawerOpen(false)
    toast.info('Editing events is not available yet', {
      description: 'We will enable editing once calendar write APIs are connected.',
    })
    onEventClick?.(event)
  }

  const handleDelete = (event: CalendarEvent) => {
    setDrawerOpen(false)
    toast.info('Event deletion is coming soon', {
      description: 'Delete will be enabled after connecting calendar write APIs.',
    })
  }

  // Filter events based on selected calendars
  const filteredEvents = events.filter((event) => {
    const calendar = calendars.find((cal) => {
      if (cal.id === 'google' && event.source === 'google') return cal.checked
      if (cal.id === 'tasks' && event.source === 'task') return cal.checked
      if (cal.id === 'work_orders' && event.source === 'work_order') return cal.checked
      if (cal.id === 'transactions' && event.source === 'transaction') return cal.checked
      if (cal.id === 'leases' && event.source === 'lease') return cal.checked
      return false
    })
    return calendar?.checked
  })

  const handleDateChange = (date: Date) => {
    if (view === 'month') {
      onMonthChange(startOfMonth(date))
    } else if (view === 'week') {
      onMonthChange(startOfWeek(date, { weekStartsOn: 0 }))
    } else if (view === 'day') {
      onMonthChange(startOfDay(date))
    }
    setSelectedDate(date)
  }

  const handleViewChange = (newView: CalendarView) => {
    setView(newView)
    // Adjust current date based on view
    if (newView === 'month') {
      onMonthChange(startOfMonth(currentMonth))
    } else if (newView === 'week') {
      onMonthChange(startOfWeek(currentMonth, { weekStartsOn: 0 }))
    } else if (newView === 'day') {
      onMonthChange(startOfDay(currentMonth))
    }
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      <Header
        currentDate={currentMonth}
        view={view}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onViewChange={handleViewChange}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentDate={currentMonth}
          onDateChange={handleDateChange}
          selectedDate={selectedDate}
          calendars={calendars}
          onCalendarToggle={handleCalendarToggle}
          filters={filters}
          onFiltersChange={onFiltersChange}
          onCreateClick={() => setCreateOpen(true)}
        />

        <div className="flex-1">
          {view === 'month' && (
            <MonthGrid
              currentDate={currentMonth}
              events={filteredEvents}
              onEventClick={handleEventClick}
              onDateSelect={(date) => {
                setSelectedDate(date)
                onMonthChange(startOfMonth(date))
              }}
            />
          )}
          {view === 'week' && (
            <WeekGrid
              currentDate={currentMonth}
              events={filteredEvents}
              onEventClick={handleEventClick}
              onDateSelect={(date) => {
                setSelectedDate(date)
                onMonthChange(startOfWeek(date, { weekStartsOn: 0 }))
              }}
            />
          )}
          {view === 'day' && (
            <DayGrid
              currentDate={currentMonth}
              events={filteredEvents}
              onEventClick={handleEventClick}
              onDateSelect={(date) => {
                setSelectedDate(date)
                onMonthChange(startOfDay(date))
              }}
            />
          )}
        </div>
      </div>

      <EventDetailDrawer
        event={selectedEvent}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <AddEventModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultDate={selectedDate || currentMonth}
        onCreated={() => {
          onRefreshEvents?.()
        }}
      />
    </div>
  )
}
