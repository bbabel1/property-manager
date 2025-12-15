'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CalendarEvent, EVENT_COLORS } from '@/types/calendar';
import {
  X,
  Pencil,
  Trash2,
  MoreVertical,
  Video,
  Phone,
  Copy,
  ExternalLink,
  MessageSquare,
  Mail,
  Bell,
  Check,
  Calendar as CalendarIcon,
  Briefcase,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/components/ui/utils';

interface EventDetailDrawerProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (event: CalendarEvent) => void;
}

// Mock guest data - in real app, this would come from the event or API
const getMockGuests = (event: CalendarEvent | null) => {
  if (!event) return [];

  // For Google events, return mock guests
  if (event.source === 'google') {
    return [
      {
        id: '1',
        name: 'James Torres',
        email: 'james@example.com',
        rsvp: 'yes',
        role: 'Organizer',
        avatar: null,
        color: 'purple',
      },
      {
        id: '2',
        name: 'Luz Marie Dela Pena',
        email: 'luz@example.com',
        rsvp: 'yes',
        role: 'Optional',
        avatar: null,
        color: 'green',
      },
      {
        id: '3',
        name: 'Brandon Babel',
        email: 'brandon@example.com',
        rsvp: 'awaiting',
        role: null,
        avatar: null,
        color: 'blue',
      },
      {
        id: '4',
        name: 'Rosalinda Mercedes',
        email: 'rosalinda@example.com',
        rsvp: 'awaiting',
        role: null,
        avatar: null,
        color: 'orange',
      },
      {
        id: '5',
        name: 'Rosian Prudente',
        email: 'rosian@example.com',
        rsvp: 'awaiting',
        role: null,
        avatar: null,
        color: 'brown',
      },
    ];
  }

  return [];
};

const getAvatarColor = (color: string) => {
  const colors: Record<string, string> = {
    purple: 'bg-purple-500',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    orange: 'bg-orange-500',
    brown: 'bg-amber-700',
  };
  return colors[color] || 'bg-gray-500';
};

export function EventDetailDrawer({
  event,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: EventDetailDrawerProps) {
  const [copied, setCopied] = useState(false);
  const [geminiNotes, setGeminiNotes] = useState(false);
  const [rsvp, setRsvp] = useState<'yes' | 'no' | 'maybe' | null>(null);

  if (!event) return null;

  const guests = getMockGuests(event);
  const yesCount = guests.filter((g) => g.rsvp === 'yes').length;
  const awaitingCount = guests.filter((g) => g.rsvp === 'awaiting').length;
  const organizer = guests.find((g) => g.role === 'Organizer');

  const formatDateTime = (dateStr: string, allDay: boolean) => {
    const date = parseISO(dateStr);
    if (allDay) {
      return format(date, 'EEEE, MMMM d, yyyy');
    }
    return format(date, 'EEEE, MMMM d • h:mm a');
  };

  const formatTimeRange = () => {
    const start = parseISO(event.start);
    const end = event.end ? parseISO(event.end) : null;

    if (event.allDay) {
      return format(start, 'EEEE, MMMM d, yyyy');
    }

    const startTime = format(start, 'h:mm');
    const endTime = end ? format(end, 'h:mm a') : '';
    return `${format(start, 'EEEE, MMMM d')} • ${startTime} - ${endTime}`;
  };

  const handleCopyLink = async () => {
    // Mock Google Meet link - in real app, this would come from the event
    const meetLink = 'meet.google.com/bcn-sdms-zcc';
    try {
      await navigator.clipboard.writeText(meetLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getSourceLink = () => {
    switch (event.source) {
      case 'task':
        return `/tasks/${event.sourceId}`;
      case 'work_order':
        return `/maintenance?workOrder=${event.sourceId}`;
      case 'transaction':
        return `/bills?transaction=${event.sourceId}`;
      case 'lease':
        return `/leases/${event.sourceId}`;
      default:
        return null;
    }
  };

  const sourceLink = getSourceLink();
  const isGoogleEvent = event.source === 'google';
  const hasMeetLink = isGoogleEvent; // Mock: assume Google events have Meet links

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[680px] max-w-[680px] overflow-y-auto bg-white p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{event.title}</DialogTitle>
        </DialogHeader>
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex flex-1 items-start gap-3">
              <div
                className="mt-1 h-4 w-4 flex-shrink-0 rounded"
                style={{ backgroundColor: event.color }}
              />
              <div className="min-w-0 flex-1">
                <h2 className="mb-2 text-2xl font-normal break-words text-gray-900">
                  {event.title}
                </h2>
                <div className="text-sm text-gray-600">{formatTimeRange()}</div>
                {isGoogleEvent && (
                  <div className="mt-1 text-sm text-gray-600">Weekly on weekdays</div>
                )}
              </div>
            </div>
            <div className="ml-4 flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit?.(event)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onDelete?.(event)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-6">
          {/* Google Meet Section */}
          {hasMeetLink && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Button className="flex items-center gap-2 rounded-md bg-[#1a73e8] px-4 py-2 text-white hover:bg-[#1557b0]">
                  <Video className="h-4 w-4" />
                  Join with Google Meet
                </Button>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span>meet.google.com/bcn-sdms-zcc</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyLink}>
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Phone dial-in */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Phone className="h-4 w-4" />
                  <span>Join by phone</span>
                </div>
                <div className="pl-6 text-sm text-gray-600">
                  <div>+1 267-553-4862</div>
                  <div>PIN: 377 971 367#</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 pl-6 text-sm text-blue-600 hover:text-blue-700"
                >
                  <ExternalLink className="mr-1 h-3 w-3" />
                  More phone numbers
                </Button>
              </div>

              {/* Gemini meeting notes */}
              <div className="border-t border-gray-200 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Sparkles className="h-4 w-4" />
                    <span>Turn on Gemini meeting notes</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-1 pl-6 text-xs text-gray-500">
                  Share notes and transcript with internal guests
                </p>
              </div>
            </div>
          )}

          {/* Guests Section */}
          {guests.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <div className="flex items-center gap-1">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-300">
                      <span className="text-xs text-gray-700">{guests.length}</span>
                    </div>
                  </div>
                  <span>{guests.length} guests</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600">
                  <span>{yesCount} yes</span>
                  <span>•</span>
                  <span>{awaitingCount} awaiting</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Mail className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {guests.map((guest) => (
                  <div key={guest.id} className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={guest.avatar || undefined} />
                      <AvatarFallback
                        className={cn('text-xs text-white', getAvatarColor(guest.color))}
                      >
                        {guest.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-900">{guest.name}</span>
                        {guest.rsvp === 'yes' && <Check className="h-4 w-4 text-green-600" />}
                      </div>
                      {guest.role && <div className="text-xs text-gray-500">{guest.role}</div>}
                      {guest.name === 'Brandon Babel' && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs text-blue-600 hover:text-blue-700"
                        >
                          Set your working location
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notification, Organizer, Availability */}
          <div className="space-y-3 border-t border-gray-200 pt-2">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Bell className="h-4 w-4" />
              <span>10 minutes before</span>
            </div>
            {organizer && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <CalendarIcon className="h-4 w-4" />
                <span>{organizer.name}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Briefcase className="h-4 w-4" />
              <span>Free</span>
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div className="border-t border-gray-200 pt-2">
              <p className="text-sm whitespace-pre-wrap text-gray-700">{event.description}</p>
            </div>
          )}

          {/* Location */}
          {event.location && (
            <div className="border-t border-gray-200 pt-2">
              <div className="text-sm text-gray-700">{event.location}</div>
            </div>
          )}

          {/* Source Link */}
          {!isGoogleEvent && sourceLink && (
            <div className="border-t border-gray-200 pt-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  window.location.href = sourceLink;
                }}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View {event.source === 'work_order' ? 'Work Order' : event.source}
              </Button>
            </div>
          )}
        </div>

        {/* RSVP Section */}
        {isGoogleEvent && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-4">
            <span className="text-sm font-medium text-gray-700">Going?</span>
            <div className="flex items-center gap-2">
              <Button
                variant={rsvp === 'yes' ? 'default' : 'outline'}
                size="sm"
                className={cn('px-4', rsvp === 'yes' && 'bg-blue-600 hover:bg-blue-700')}
                onClick={() => setRsvp(rsvp === 'yes' ? null : 'yes')}
              >
                Yes
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
              <Button
                variant={rsvp === 'no' ? 'default' : 'outline'}
                size="sm"
                className={cn('px-4', rsvp === 'no' && 'bg-red-600 text-white hover:bg-red-700')}
                onClick={() => setRsvp(rsvp === 'no' ? null : 'no')}
              >
                No
              </Button>
              <Button
                variant={rsvp === 'maybe' ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  'px-4',
                  rsvp === 'maybe' && 'bg-yellow-600 text-white hover:bg-yellow-700',
                )}
                onClick={() => setRsvp(rsvp === 'maybe' ? null : 'maybe')}
              >
                Maybe
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
