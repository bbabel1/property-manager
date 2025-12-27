"use client"

import React from 'react'
import { CalendarEvent } from '@/types/calendar'
import { format, endOfMonth, getDay, isSameDay, parseISO, startOfDay } from 'date-fns'
import { Button } from '@/components/ui/button'

type MonthGridProps = {
  currentDate: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  onDateSelect?: (date: Date) => void
}

export function MonthGrid({
  currentDate,
  events,
  onEventClick,
  onDateSelect: _onDateSelect,
}: MonthGridProps) {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

  const firstDayOfMonth = getDay(new Date(year, month, 1))
  const daysInMonth = endOfMonth(currentDate).getDate()
  const daysInPrevMonth = endOfMonth(new Date(year, month - 1, 1)).getDate()

  type DayCell = {
    day: number
    month: number
    year: number
    isCurrentMonth: boolean
    date: Date
  }

  const days: DayCell[] = []

  // Previous month days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i
    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear = month === 0 ? year - 1 : year
    days.push({
      day,
      month: prevMonth,
      year: prevYear,
      isCurrentMonth: false,
      date: new Date(prevYear, prevMonth, day),
    })
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({
      day: i,
      month,
      year,
      isCurrentMonth: true,
      date: new Date(year, month, i),
    })
  }

  // Next month days
  const remainingDays = 42 - days.length
  for (let i = 1; i <= remainingDays; i++) {
    const nextMonth = month === 11 ? 0 : month + 1
    const nextYear = month === 11 ? year + 1 : year
    days.push({
      day: i,
      month: nextMonth,
      year: nextYear,
      isCurrentMonth: false,
      date: new Date(nextYear, nextMonth, i),
    })
  }

  const getEventsForDay = (date: Date) => {
    return events.filter((event) => {
      const eventDate = startOfDay(parseISO(event.start))
      const dayDate = startOfDay(date)
      return isSameDay(eventDate, dayDate)
    })
  }

  const getMultiDayEvents = (date: Date) => {
    return events.filter((event) => {
      if (!event.allDay || !event.end) return false
      const start = startOfDay(parseISO(event.start))
      const end = startOfDay(parseISO(event.end))
      const dayDate = startOfDay(date)
      return dayDate >= start && dayDate <= end
    })
  }

  const getEventColor = (color: string) => {
    // Map color hex to Tailwind classes
    if (color === '#f4b400' || color.includes('yellow')) {
      return 'bg-yellow-400'
    }
    if (color === '#1a73e8' || color.includes('blue')) {
      return 'bg-[#1a73e8]'
    }
    if (color === '#0d9488' || color.includes('teal')) {
      return 'bg-teal-500'
    }
    if (color === '#ef4444' || color.includes('red')) {
      return 'bg-red-500'
    }
    return 'bg-gray-400'
  }

  const getEventDotColor = (color: string) => {
    if (color === '#f4b400' || color.includes('yellow')) {
      return 'bg-yellow-400'
    }
    if (color === '#1a73e8' || color.includes('blue')) {
      return 'bg-[#1a73e8]'
    }
    if (color === '#0d9488' || color.includes('teal')) {
      return 'bg-teal-500'
    }
    return 'bg-gray-400'
  }

  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]

  const today = new Date()

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {daysOfWeek.map((day, i) => (
          <div
            key={i}
            className="text-center py-2 text-xs font-medium text-gray-500 border-l border-gray-200 first:border-l-0"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-6">
        {days.map((day, i) => {
          const dayEvents = getEventsForDay(day.date).filter((e) => !e.allDay)
          const allDayEvents = getEventsForDay(day.date).filter((e) => e.allDay)
          const multiDayEvents = getMultiDayEvents(day.date)
          const isFirstOfMonth = day.day === 1
          const isToday = isSameDay(day.date, today)

          return (
            <div
              key={i}
              className={`
                border-l border-b border-gray-200 first:border-l-0 min-h-[120px] p-1
                ${!day.isCurrentMonth ? 'bg-gray-50' : ''}
              `}
            >
              {/* Date number */}
              <div
                className={`text-sm mb-1 ${!day.isCurrentMonth ? 'text-gray-400' : isToday ? 'text-[#1a73e8] font-semibold' : 'text-gray-700'}`}
              >
                {isFirstOfMonth && !day.isCurrentMonth
                  ? `${monthNames[day.month]} `
                  : ''}
                {day.day}
              </div>

              {/* All-day events */}
              {allDayEvents.map((event) => (
                <Button
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  variant="ghost"
                  className={`
                    w-full text-left text-xs text-white px-2 py-0.5 rounded mb-0.5 truncate h-auto
                    ${getEventColor(event.color)} hover:opacity-90 transition-opacity
                  `}
                >
                  {event.title}
                </Button>
              ))}

              {/* Multi-day event bars */}
              {multiDayEvents
                .filter((e) => {
                  const eventDate = startOfDay(parseISO(e.start))
                  return isSameDay(eventDate, day.date)
                })
                .map((event) => (
                  <Button
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    variant="ghost"
                    className={`
                    w-full text-left text-xs text-white px-2 py-0.5 rounded mb-0.5 truncate h-auto
                    ${getEventColor(event.color)} hover:opacity-90 transition-opacity
                  `}
                  >
                    {event.title}
                  </Button>
                ))}

              {/* Timed events */}
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((event) => (
                  <Button
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    variant="ghost"
                    className="w-full text-left flex items-center gap-1 text-xs text-gray-700 hover:bg-gray-100 rounded px-1 py-0.5 truncate h-auto"
                  >
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${getEventDotColor(event.color)}`}
                    ></span>
                    <span className="text-gray-500">
                      {format(parseISO(event.start), 'ha')}
                    </span>
                    <span className="truncate">{event.title}</span>
                  </Button>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-500 px-1">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
