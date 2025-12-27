"use client"

import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { startOfMonth, addMonths, subMonths, getDaysInMonth, isSameDay } from 'date-fns'

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
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">
          {monthNames[month]} {year}
        </span>
        <div className="flex items-center gap-1">
          <Button
            onClick={prevMonth}
            variant="ghost"
            size="icon"
            className="p-1 h-auto w-auto hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </Button>
          <Button
            onClick={nextMonth}
            variant="ghost"
            size="icon"
            className="p-1 h-auto w-auto hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0">
        {daysOfWeek.map((day, i) => (
          <div
            key={i}
            className="text-center text-xs text-gray-500 py-1 font-medium"
          >
            {day}
          </div>
        ))}

        {days.map((day, i) => {
          const isSelected = selectedDate && isSameDay(day.date, selectedDate)
          return (
            <Button
              key={i}
              variant="ghost"
              onClick={() => handleDayClick(day.date)}
              className={`
                text-center text-xs py-1 w-7 h-7 rounded-full transition-colors
                ${day.isCurrentMonth ? 'text-gray-700' : 'text-gray-400'}
                ${day.isToday ? 'bg-[#1a73e8] text-white font-medium' : ''}
                ${isSelected && !day.isToday ? 'bg-blue-100 text-blue-700' : ''}
                ${!day.isToday && !isSelected ? 'hover:bg-gray-100' : ''}
              `}
            >
              {day.day}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
