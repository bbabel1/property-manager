"use client"

import React from 'react'
import {
  Menu,
  Search,
  HelpCircle,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar as CalendarIcon,
  CheckSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { CalendarView } from './GoogleCalendarView'

type HeaderProps = {
  currentDate: Date
  view: CalendarView
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onViewChange: (view: CalendarView) => void
}

export function Header({
  currentDate,
  view,
  onPrev,
  onNext,
  onToday,
  onViewChange,
}: HeaderProps) {
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

  const getDateDisplay = () => {
    if (view === 'month') {
      return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    } else if (view === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 })
      const sameMonth = weekStart.getMonth() === weekEnd.getMonth()
      if (sameMonth) {
        return `${monthNames[weekStart.getMonth()]} ${weekStart.getDate()} - ${weekEnd.getDate()}, ${weekStart.getFullYear()}`
      } else {
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`
      }
    } else if (view === 'day') {
      return `${monthNames[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}`
    }
    return ''
  }

  return (
    <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-4">
      {/* Left section */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <Menu className="w-6 h-6 text-gray-600" />
        </Button>

        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-500 rounded flex items-center justify-center text-white font-bold text-lg">
            7
          </div>
          <span className="text-xl text-gray-700">Calendar</span>
        </div>

        <Button
          onClick={onToday}
          variant="outline"
          className="ml-4 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Today
        </Button>

        <div className="flex items-center gap-1">
          <Button
            onClick={onPrev}
            variant="ghost"
            size="icon"
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </Button>
          <Button
            onClick={onNext}
            variant="ghost"
            size="icon"
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </Button>
        </div>

        <h1 className="text-xl text-gray-700 ml-2">
          {getDateDisplay()}
        </h1>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <Search className="w-5 h-5 text-gray-600" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <HelpCircle className="w-5 h-5 text-gray-600" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <Settings className="w-5 h-5 text-gray-600" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="flex items-center gap-2 px-3 py-2 bg-[#e8f0fe] text-[#1a73e8] rounded-md text-sm font-medium hover:bg-[#d2e3fc] transition-colors ml-2">
              <span className="capitalize">{view}</span>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onViewChange('month')}>
              Month
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewChange('week')}>
              Week
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewChange('day')}>
              Day
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-1 ml-2 border-l border-gray-200 pl-4">
          <Button className="p-2 bg-[#1a73e8] rounded-md hover:bg-[#1557b0] transition-colors">
            <CalendarIcon className="w-5 h-5 text-white" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <CheckSquare className="w-5 h-5 text-gray-600" />
          </Button>
        </div>

      </div>
    </header>
  )
}

