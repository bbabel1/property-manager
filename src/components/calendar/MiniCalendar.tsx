"use client"

import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Body, Label } from '@/ui/typography'
import { startOfMonth, addMonths, subMonths, getDaysInMonth, isSameDay } from 'date-fns'
import { cn } from '@/components/ui/utils'

type MiniCalendarProps = {
  currentDate: Date
  onDateChange: (date: Date) => void
  selectedDate?: Date
}

export function MiniCalendar({ currentDate, onDateChange, selectedDate }: MiniCalendarProps) {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  const daysOfWeek = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = getDaysInMonth(currentDate)
  const daysInPrevMonth = getDaysInMonth(subMonths(currentDate, 1))

  const prevMonth = () => {
    onDateChange(startOfMonth(subMonths(currentDate, 1)))
  }

  const nextMonth = () => {
    onDateChange(startOfMonth(addMonths(currentDate, 1)))
  }

  const days: {
    day: number
    isCurrentMonth: boolean
    isToday: boolean
    date: Date
  }[] = []

  // Previous month days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    days.push({
      day: daysInPrevMonth - i,
      isCurrentMonth: false,
      isToday: false,
      date: new Date(year, month - 1, daysInPrevMonth - i),
    })
  }

  // Current month days
  const today = new Date()
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i)
    const isToday = isSameDay(date, today)
    days.push({
      day: i,
      isCurrentMonth: true,
      isToday,
      date,
    })
  }

  // Next month days
  const remainingDays = 42 - days.length
  for (let i = 1; i <= remainingDays; i++) {
    days.push({
      day: i,
      isCurrentMonth: false,
      isToday: false,
      date: new Date(year, month + 1, i),
    })
  }

  const handleDayClick = (date: Date) => {
    onDateChange(date)
  }

  return (
    <div className="px-3 py-2">
      <div className="mb-2 flex items-center justify-between">
        <Label as="span" size="sm">
          {monthNames[month]} {year}
        </Label>
        <div className="flex items-center gap-1">
          <Button
            onClick={prevMonth}
            variant="ghost"
            size="icon"
            className="h-auto w-auto rounded-full p-1 transition-colors hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
          </Button>
          <Button
            onClick={nextMonth}
            variant="ghost"
            size="icon"
            className="h-auto w-auto rounded-full p-1 transition-colors hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0">
        {daysOfWeek.map((day, i) => (
          <div
            key={i}
            className="py-1 text-center"
          >
            <Label as="span" size="xs" tone="muted" className="tracking-wide">
              {day}
            </Label>
          </div>
        ))}

        {days.map((day, i) => {
          const isSelected = selectedDate && isSameDay(day.date, selectedDate)
          return (
            <Button
              key={i}
              variant="ghost"
              onClick={() => handleDayClick(day.date)}
              className={cn(
                'h-7 w-7 rounded-full p-1 text-center transition-colors',
                day.isToday ? 'bg-primary' : '',
                isSelected && !day.isToday ? 'bg-primary/10' : '',
                !day.isToday && !isSelected ? 'hover:bg-muted' : '',
              )}
            >
              <Body
                as="span"
                size="xs"
                className={cn(
                  'leading-none',
                  day.isToday
                    ? 'text-primary-foreground font-semibold'
                    : day.isCurrentMonth
                      ? 'text-foreground'
                      : 'text-muted-foreground',
                  isSelected && !day.isToday ? 'text-primary' : '',
                )}
              >
                {day.day}
              </Body>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
