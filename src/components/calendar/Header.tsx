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
import { Body, Heading, Label } from '@/ui/typography'
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
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4">
      {/* Left section */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-auto w-auto rounded-full p-2 transition-colors hover:bg-muted"
        >
          <Menu className="h-6 w-6 text-muted-foreground" />
        </Button>

        <div className="flex items-center gap-2">
          <Heading
            as="div"
            size="h6"
            className="flex h-10 w-10 items-center justify-center rounded bg-primary text-primary-foreground"
          >
            7
          </Heading>
          <Heading as="span" size="h5">
            Calendar
          </Heading>
        </div>

        <Button
          onClick={onToday}
          variant="outline"
          className="ml-4 px-4 py-2"
        >
          Today
        </Button>

        <div className="flex items-center gap-1">
          <Button
            onClick={onPrev}
            variant="ghost"
            size="icon"
            className="h-auto w-auto rounded-full p-2 transition-colors hover:bg-muted"
          >
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </Button>
          <Button
            onClick={onNext}
            variant="ghost"
            size="icon"
            className="h-auto w-auto rounded-full p-2 transition-colors hover:bg-muted"
          >
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>

        <Heading as="h1" size="h4" className="ml-2">
          {getDateDisplay()}
        </Heading>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-auto w-auto rounded-full p-2 transition-colors hover:bg-muted"
        >
          <Search className="h-5 w-5 text-muted-foreground" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-auto w-auto rounded-full p-2 transition-colors hover:bg-muted"
        >
          <HelpCircle className="h-5 w-5 text-muted-foreground" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-auto w-auto rounded-full p-2 transition-colors hover:bg-muted"
        >
          <Settings className="h-5 w-5 text-muted-foreground" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="ml-2 flex items-center gap-2 rounded-md bg-[#e8f0fe] px-3 py-2 text-[#1a73e8] transition-colors hover:bg-[#d2e3fc]">
              <Label as="span" size="sm" className="capitalize text-current">
                {view}
              </Label>
              <ChevronDown className="h-4 w-4" />
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

        <div className="ml-2 flex items-center gap-1 border-l border-gray-200 pl-4">
          <Button className="rounded-md bg-primary p-2 transition-colors hover:bg-primary/90">
            <CalendarIcon className="h-5 w-5 text-primary-foreground" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-md p-2 transition-colors hover:bg-muted"
          >
            <CheckSquare className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>

      </div>
    </header>
  )
}
