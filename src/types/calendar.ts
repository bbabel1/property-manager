/**
 * Calendar Types
 * 
 * Type definitions for calendar events and related data structures
 */

export type CalendarEventSource = 'task' | 'work_order' | 'transaction' | 'lease' | 'google';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO datetime in UTC
  end: string | null; // ISO datetime in UTC
  allDay: boolean;
  source: CalendarEventSource;
  sourceId: string;
  color: string;
  description?: string;
  location?: string;
  timezone?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  recurringEventId?: string;
  htmlLink?: string;
  [key: string]: any;
}

export interface CalendarEventFilter {
  google: boolean;
  tasks: boolean;
  workOrders: boolean;
  transactions: boolean;
  leases: boolean;
}

export const DEFAULT_EVENT_FILTERS: CalendarEventFilter = {
  google: true,
  tasks: true,
  workOrders: true,
  transactions: false,
  leases: false,
};

export const EVENT_COLORS: Record<CalendarEventSource, string> = {
  task: '#f4b400', // Yellow accent for meeting tasks
  work_order: '#0d9488', // Teal for multi-day/maintenance
  transaction: '#188038', // Green for accepted/financial
  lease: '#9c27b0', // Purple for leases
  google: '#1a73e8', // Primary blue
};
