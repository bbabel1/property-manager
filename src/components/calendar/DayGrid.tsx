"use client"

import React from 'react'
import { CalendarEvent } from '@/types/calendar'
import { format, isSameDay, parseISO, startOfDay, addDays, isWithinInterval } from 'date-fns'
import { Button } from '@/components/ui/button'

type DayGridProps = {
  currentDate: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  onDateSelect?: (date: Date) => void
}

const HOURS = Array.from({ length: 24 }, (_, i) => i)

export function DayGrid({
  currentDate,
  events,
  onEventClick,
  onDateSelect,
}: DayGridProps) {
  const today = new Date()
  const isToday = isSameDay(currentDate, today)

  const getEventsForDay = () => {
    const dayStart = startOfDay(currentDate)
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

  const getEventPosition = (event: CalendarEvent) => {
    const eventStart = parseISO(event.start)
    const eventEnd = event.end ? parseISO(event.end) : addDays(eventStart, 1)
    const dayStart = startOfDay(currentDate)
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

  const dayEvents = getEventsForDay()

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Day header */}
      <div className="border-b border-gray-200 py-2 px-4">
        <div className="text-sm font-medium text-gray-500 mb-1">
          {format(currentDate, 'EEEE')}
        </div>
        <div
          className={`text-2xl font-medium ${
            isToday ? 'text-[#1a73e8]' : 'text-gray-700'
          }`}
        >
          {format(currentDate, 'MMMM d, yyyy')}
        </div>
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2">
          {/* Time column */}
          <div className="border-r border-gray-200 w-20">
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

          {/* Day column */}
          <div className={`relative ${isToday ? 'bg-blue-50/30' : ''}`}>
            {/* Hour cells */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-[60px] border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                onClick={() => {
                  const newDate = new Date(currentDate)
                  newDate.setHours(hour, 0, 0, 0)
                  onDateSelect?.(newDate)
                }}
              />
            ))}

            {/* Events */}
            {dayEvents.map((event) => {
              const { top, height } = getEventPosition(event)
              return (
                <Button
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  variant="ghost"
                  className={`
                    absolute left-2 right-2 text-xs text-white px-3 py-2 rounded
                    ${getEventColor(event.color)} hover:opacity-90 transition-opacity
                    overflow-hidden
                  `}
                  style={{
                    top: `${top}px`,
                    height: `${Math.max(height, 40)}px`,
                  }}
                >
                  <div className="font-medium truncate">{event.title}</div>
                  {!event.allDay && (
                    <div className="text-[11px] opacity-90 mt-1">
                      {format(parseISO(event.start), 'ha')} - {event.end ? format(parseISO(event.end), 'ha') : ''}
                    </div>
                  )}
                  {event.location && (
                    <div className="text-[10px] opacity-80 mt-1 truncate">
                      📍 {event.location}
                    </div>
                  )}
                </Button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

