"use client"

import React, { useState } from 'react'
import {
  Plus,
  ChevronDown,
  ChevronUp,
  User,
} from 'lucide-react'
import { MiniCalendar } from './MiniCalendar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CalendarEventFilter } from '@/types/calendar'

type CalendarInfo = {
  id: string
  name: string
  color: string
  checked: boolean
}

type SidebarProps = {
  currentDate: Date
  onDateChange: (date: Date) => void
  selectedDate?: Date
  calendars: CalendarInfo[]
  onCalendarToggle: (id: string) => void
  filters: CalendarEventFilter
  onFiltersChange: (filters: CalendarEventFilter) => void
  onCreateClick?: () => void
}

export function Sidebar({
  currentDate,
  onDateChange,
  selectedDate,
  calendars,
  onCalendarToggle,
  filters,
  onFiltersChange,
  onCreateClick,
}: SidebarProps) {
  const [myCalendarsOpen, setMyCalendarsOpen] = useState(true)

  return (
    <aside className="w-64 border-r border-gray-200 bg-white flex flex-col h-full overflow-y-auto">
      {/* Create Button */}
      <div className="p-4">
        <Button
          className="flex items-center gap-3 px-6 py-3 bg-white border border-gray-300 rounded-full shadow-sm hover:shadow-md hover:bg-gray-50 transition-all w-full"
          onClick={onCreateClick}
        >
          <Plus className="w-6 h-6 text-gray-700" />
          <span className="text-sm font-medium text-gray-700">Create</span>
          <ChevronDown className="w-4 h-4 text-gray-500 ml-2" />
        </Button>
      </div>

      {/* Mini Calendar */}
      <MiniCalendar
        currentDate={currentDate}
        onDateChange={onDateChange}
        selectedDate={selectedDate}
      />

      {/* Meet with... */}
      <div className="px-3 py-2 border-t border-gray-100">
        <div className="text-sm font-medium text-gray-700 mb-2">
          Meet with...
        </div>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search for people"
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-100 rounded-md border-0 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* My calendars */}
      <div className="px-3 py-2 border-t border-gray-100">
        <Button
          onClick={() => setMyCalendarsOpen(!myCalendarsOpen)}
          variant="ghost"
          className="flex items-center justify-between w-full text-sm font-medium text-gray-700 hover:bg-gray-100 rounded px-1 py-1 h-auto"
        >
          <span>My calendars</span>
          {myCalendarsOpen ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </Button>
        {myCalendarsOpen && (
          <div className="mt-2 space-y-1">
            {calendars.map((cal) => (
              <label
                key={cal.id}
                className="flex items-center gap-2 px-1 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={cal.checked}
                  onChange={() => onCalendarToggle(cal.id)}
                  className="w-4 h-4 rounded border-gray-300"
                  style={{
                    accentColor: cal.color,
                  }}
                />
                <span>{cal.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

    </aside>
  )
}
