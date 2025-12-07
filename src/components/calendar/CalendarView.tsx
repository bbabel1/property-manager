"use client"

import { useMemo } from 'react'
import { CalendarEvent } from '@/types/calendar'
import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'

interface CalendarViewProps {
  events: CalendarEvent[]
  selectedDate?: Date
  currentMonth: Date
  onDateSelect?: (date: Date) => void
  onEventClick?: (event: CalendarEvent) => void
  onMonthChange?: (month: Date) => void
}

type WeekSegment = {
  event: CalendarEvent
  startIdx: number
  span: number
}

const WEEK_STARTS_ON = 0 // Sunday

export function CalendarView({
  events,
  selectedDate,
  currentMonth,
  onDateSelect,
  onEventClick,
  onMonthChange,
}: CalendarViewProps) {
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    events.forEach((event) => {
      const startDate = startOfDay(parseISO(event.start))
      const rawEnd = event.end ? parseISO(event.end) : startDate
      const endDate =
        event.allDay && event.end
          ? addDays(parseISO(event.end), -1)
          : rawEnd

      for (let day = startDate; day <= endDate; day = addDays(day, 1)) {
        const dateKey = format(day, 'yyyy-MM-dd')
        if (!map.has(dateKey)) {
          map.set(dateKey, [])
        }
        map.get(dateKey)!.push(event)
      }
    })
    return map
  }, [events])

  const weeks = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: WEEK_STARTS_ON })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: WEEK_STARTS_ON })

    const allWeeks: { days: Date[]; rows: WeekSegment[][] }[] = []

    for (let date = calendarStart; date <= calendarEnd; date = addDays(date, 7)) {
      const days = Array.from({ length: 7 }, (_, i) => addDays(date, i))
      const weekStart = days[0]
      const weekEnd = days[6]

      const segments: WeekSegment[] = events.map((event) => {
        const startDate = parseISO(event.start)
        const rawEnd = event.end ? parseISO(event.end) : startDate
        const endDate =
          event.allDay && event.end
            ? addDays(parseISO(event.end), -1) // Google all-day end is exclusive
            : rawEnd

        if (startDate > weekEnd || endDate < weekStart) return null

        const segmentStart = startDate < weekStart ? weekStart : startDate
        const segmentEnd = endDate > weekEnd ? weekEnd : endDate
        const startIdx = differenceInCalendarDays(segmentStart, weekStart)
        const span = differenceInCalendarDays(segmentEnd, weekStart) - startIdx + 1

        return {
          event,
          startIdx,
          span,
        }
      }).filter(Boolean) as WeekSegment[]

      segments.sort((a, b) => a.startIdx - b.startIdx || b.span - a.span)

      const rows: WeekSegment[][] = []
      segments.forEach((segment) => {
        let placed = false
        for (const row of rows) {
          const conflict = row.some(
            (existing) =>
              (segment.startIdx >= existing.startIdx && segment.startIdx < existing.startIdx + existing.span) ||
              (existing.startIdx >= segment.startIdx && existing.startIdx < segment.startIdx + segment.span)
          )
          if (!conflict) {
            row.push(segment)
            placed = true
            break
          }
        }
        if (!placed) {
          rows.push([segment])
        }
      })

      allWeeks.push({ days, rows })
    }

    return allWeeks
  }, [currentMonth, events])

  const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const today = new Date()
  const eventRowHeight = 24

  const toRgba = (hex: string, alpha: number) => {
    const sanitized = hex.replace('#', '')
    const int = parseInt(sanitized.length === 3 ? sanitized.split('').map((c) => c + c).join('') : sanitized, 16)
    const r = (int >> 16) & 255
    const g = (int >> 8) & 255
    const b = int & 255
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  const handleDateSelect = (day: Date) => {
    onDateSelect?.(day)
    if (!isSameMonth(day, currentMonth)) {
      onMonthChange?.(day)
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:bg-slate-950/80">
      <div className="grid grid-cols-7 gap-px bg-white px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-900/80">
        {dayNames.map((name) => (
          <div key={name} className="text-center text-[12px] font-semibold text-slate-600">
            {name}
          </div>
        ))}
      </div>
      <div className="divide-y divide-slate-200">
        {weeks.map((week, weekIdx) => {
          const paddingBottom = 36 + week.rows.length * (eventRowHeight + 6)
          return (
            <div
              key={weekIdx}
              className="relative grid grid-cols-7 bg-white dark:bg-slate-950/80"
              style={{ minHeight: 120, paddingBottom }}
            >
              {week.days.map((day, dayIdx) => {
                const dateKey = format(day, 'yyyy-MM-dd')
                const isCurrentMonth = isSameMonth(day, currentMonth)
                const isToday = isSameDay(day, today)
                const isSelected = selectedDate ? isSameDay(day, selectedDate) : false

                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => handleDateSelect(day)}
                    className={[
                      'relative flex flex-col border-r border-b border-slate-200 px-2.5 pb-2 pt-2 text-left transition-colors hover:bg-gray-100/70 dark:hover:bg-slate-900/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40',
                      dayIdx === 6 ? 'border-r-0' : '',
                      isSelected ? 'bg-primary/5 ring-1 ring-primary/40 dark:bg-primary/10' : '',
                      !isCurrentMonth ? 'bg-slate-50 text-muted-foreground/70 dark:bg-slate-900/40' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between">
                      <span
                        className={[
                          'flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                          isToday ? 'bg-primary text-primary-foreground shadow-sm' : 'text-slate-800',
                          !isCurrentMonth ? 'opacity-60' : '',
                        ].join(' ')}
                      >
                        {format(day, 'd')}
                      </span>
                      {eventsByDate.get(dateKey)?.length && eventsByDate.get(dateKey)!.length > 3 ? (
                        <span className="rounded-full bg-slate-100 px-2 text-[11px] font-semibold text-slate-600">
                          {eventsByDate.get(dateKey)!.length} more
                        </span>
                      ) : null}
                    </div>
                  </button>
                )
              })}

              {week.rows.map((row, rowIdx) => (
                <div
                  key={`row-${weekIdx}-${rowIdx}`}
                  className="pointer-events-none absolute inset-x-0"
                  style={{ top: 48 + rowIdx * (eventRowHeight + 6) }}
                >
                  <div className="grid grid-cols-7 gap-2 px-2.5">
                    {row.map((segment, segmentIdx) => (
                      <button
                        key={`seg-${weekIdx}-${rowIdx}-${segmentIdx}-${segment.event.id}`}
                        type="button"
                        className="pointer-events-auto flex min-w-0 flex-col gap-1 rounded-md border text-left text-[12px] font-semibold shadow-sm transition-all hover:-translate-y-[1px] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        style={{
                          gridColumn: `${segment.startIdx + 1} / span ${segment.span}`,
                          backgroundColor: toRgba(segment.event.color, 0.12),
                          borderColor: toRgba(segment.event.color, 0.45),
                          color: '#1f2937',
                        }}
                        title={`${segment.event.title} • ${segment.event.allDay ? 'All day' : format(parseISO(segment.event.start), 'MMM d, h:mm a')}`}
                        onClick={() => onEventClick?.(segment.event)}
                      >
                        <div className="flex items-start gap-1">
                          <span
                            className="mt-0.5 h-3 w-1 rounded-sm"
                            style={{ backgroundColor: toRgba(segment.event.color, 0.9) }}
                          />
                        <span
                          className="leading-tight"
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {segment.event.title}
                        </span>
                        </div>
                        <span className="shrink-0 text-[11px] font-medium text-slate-700 leading-tight">
                          {segment.event.allDay ? 'All day' : format(parseISO(segment.event.start), 'h:mm a')}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
