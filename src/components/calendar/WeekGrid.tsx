"use client"

import React from 'react'
import { CalendarEvent } from '@/types/calendar'
import { format, startOfWeek, addDays, isSameDay, parseISO, startOfDay, isWithinInterval } from 'date-fns'
import { Button } from '@/components/ui/button'

type WeekGridProps = {
  currentDate: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  onDateSelect?: (date: Date) => void
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

export function WeekGrid({
  currentDate,
  events,
  onEventClick,
  onDateSelect,
}: WeekGridProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
  const daysOfWeek = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const daysOfWeekNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const today = new Date()

  const getEventsForDay = (date: Date) => {
    const dayStart = startOfDay(date)
    const dayEnd = addDays(dayStart, 1)
    
    return events.filter((event) => {
      const eventStart = parseISO(event.start)
      const eventEnd = event.end ? parseISO(event.end) : eventStart
      
      // Check if event overlaps with this day
      return isWithinInterval(eventStart, { start: dayStart, end: dayEnd }) ||
             isWithinInterval(dayStart, { start: eventStart, end: eventEnd }) ||
             (eventStart < dayStart && eventEnd > dayStart)
    })
  }

  const getEventPosition = (event: CalendarEvent, day: Date) => {
    const eventStart = parseISO(event.start)
    const eventEnd = event.end ? parseISO(event.end) : addDays(eventStart, 1)
    const dayStart = startOfDay(day)
    const dayEnd = addDays(dayStart, 1)
    
    // Calculate position within the day
    const startTime = eventStart < dayStart ? dayStart : eventStart
    const endTime = eventEnd > dayEnd ? dayEnd : eventEnd
    
    const startMinutes = startTime.getHours() * 60 + startTime.getMinutes()
    const endMinutes = endTime.getHours() * 60 + endTime.getMinutes()
    
    const top = (startMinutes / 60) * 60 // 60px per hour
    const height = ((endMinutes - startMinutes) / 60) * 60
    
    return { top, height }
  }

  const getEventColor = (color: string) => {
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

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-8 border-b border-gray-200">
        <div className="border-r border-gray-200"></div>
        {daysOfWeek.map((day, i) => {
          const isToday = isSameDay(day, today)
          return (
            <div
              key={i}
              className="text-center py-2 border-r border-gray-200 last:border-r-0"
            >
              <div className="text-xs font-medium text-gray-500 mb-1">
                {daysOfWeekNames[i]}
              </div>
              <div
                className={`text-lg font-medium ${
                  isToday
                    ? 'text-[#1a73e8]'
                    : 'text-gray-700'
                }`}
              >
                {format(day, 'd')}
              </div>
            </div>
          )
        })}
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-8">
          {/* Time column */}
          <div className="border-r border-gray-200">
            {HOURS.map((hour) => {
              const hourDate = new Date()
              hourDate.setHours(hour, 0, 0, 0)
              return (
                <div
                  key={hour}
                  className="h-[60px] border-b border-gray-100 text-xs text-gray-500 px-2 pt-1"
                >
                  {format(hourDate, 'ha')}
                </div>
              )
            })}
          </div>

          {/* Day columns */}
          {daysOfWeek.map((day, dayIdx) => {
            const dayEvents = getEventsForDay(day)
            const isToday = isSameDay(day, today)

            return (
              <div
                key={dayIdx}
                className={`border-r border-gray-200 last:border-r-0 relative ${
                  isToday ? 'bg-blue-50/30' : ''
                }`}
              >
                {/* Hour cells */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="h-[60px] border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      const newDate = new Date(day)
                      newDate.setHours(hour, 0, 0, 0)
                      onDateSelect?.(newDate)
                    }}
                  />
                ))}

                {/* Events */}
                {dayEvents.map((event) => {
                  const { top, height } = getEventPosition(event, day)
                  return (
                    <Button
                      key={event.id}
                      onClick={() => onEventClick(event)}
                      variant="ghost"
                      className={`
                        absolute left-0 right-0 mx-1 text-xs text-white px-2 py-1 rounded
                        ${getEventColor(event.color)} hover:opacity-90 transition-opacity
                        overflow-hidden
                      `}
                      style={{
                        top: `${top}px`,
                        height: `${Math.max(height, 20)}px`,
                      }}
                    >
                      <div className="truncate">{event.title}</div>
                      {!event.allDay && (
                        <div className="text-[10px] opacity-90">
                          {format(parseISO(event.start), 'ha')}
                        </div>
                      )}
                    </Button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
