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
import { Checkbox } from '@/ui/checkbox'
import { Body, Heading, Label } from '@/ui/typography'

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
  filters: _filters,
  onFiltersChange: _onFiltersChange,
  onCreateClick,
}: SidebarProps) {
  const [myCalendarsOpen, setMyCalendarsOpen] = useState(true)

  return (
    <aside className="flex h-full w-64 flex-col overflow-y-auto border-r border-gray-200 bg-white">
      {/* Create Button */}
      <div className="p-4">
        <Button
          className="flex w-full items-center gap-3 rounded-full border border-gray-300 bg-white px-6 py-3 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md"
          onClick={onCreateClick}
        >
          <Plus className="h-6 w-6 text-muted-foreground" />
          <Label as="span" size="sm">
            Create
          </Label>
          <ChevronDown className="ml-2 h-4 w-4 text-muted-foreground" />
        </Button>
      </div>

      {/* Mini Calendar */}
      <MiniCalendar
        currentDate={currentDate}
        onDateChange={onDateChange}
        selectedDate={selectedDate}
      />

      {/* Meet with... */}
      <div className="border-t border-gray-100 px-3 py-2">
        <Heading as="div" size="h6" className="mb-2">
          Meet with...
        </Heading>
        <div className="relative">
          <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search for people"
            className="w-full rounded-md border-0 bg-muted pl-9 pr-3 py-2 transition-colors focus:bg-white focus:ring-2 focus:ring-primary/60"
          />
        </div>
      </div>

      {/* My calendars */}
      <div className="border-t border-gray-100 px-3 py-2">
        <Button
          onClick={() => setMyCalendarsOpen(!myCalendarsOpen)}
          variant="ghost"
          className="flex h-auto w-full items-center justify-between rounded px-1 py-1"
        >
          <Label as="span" size="sm">
            My calendars
          </Label>
          {myCalendarsOpen ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </Button>
        {myCalendarsOpen && (
          <div className="mt-2 space-y-1">
            {calendars.map((cal) => (
              <label
                key={cal.id}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-muted"
              >
                <Checkbox
                  checked={cal.checked}
                  onChange={() => onCalendarToggle(cal.id)}
                  className="h-4 w-4"
                  style={{
                    accentColor: cal.color,
                  }}
                />
                <Body as="span" size="sm">
                  {cal.name}
                </Body>
              </label>
            ))}
          </div>
        )}
      </div>

    </aside>
  )
}
