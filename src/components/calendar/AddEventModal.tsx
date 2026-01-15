'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Loader2, Users, MapPin, AlignLeft } from 'lucide-react';
import { Body, Heading, Label } from '@/ui/typography';

type GuestOption = { name: string; email: string; photoUrl?: string };

type AddEventModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  onCreated: () => void;
};

export function AddEventModal({ open, onOpenChange, defaultDate, onCreated }: AddEventModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState<Date>(defaultDate || new Date());
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [allDay, setAllDay] = useState(false);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [guests, setGuests] = useState<GuestOption[]>([]);
  const [guestQuery, setGuestQuery] = useState('');
  const [guestResults, setGuestResults] = useState<GuestOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDate(defaultDate || new Date());
  }, [defaultDate]);

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (guestQuery.trim().length < 2) {
        setGuestResults([]);
        return;
      }
      try {
        const res = await fetch(
          `/api/google/people/search?query=${encodeURIComponent(guestQuery)}`,
        );
        if (res.ok) {
          const data = await res.json();
          setGuestResults(data.people || []);
        }
      } catch (err) {
        console.error('Failed to search guests', err);
      }
    }, 250);
    return () => clearTimeout(handler);
  }, [guestQuery]);

  const startIso = useMemo(() => {
    const [h, m] = startTime.split(':').map((n) => parseInt(n, 10));
    const d = new Date(date);
    d.setHours(h || 0, m || 0, 0, 0);
    return d.toISOString();
  }, [date, startTime]);

  const endIso = useMemo(() => {
    const [h, m] = endTime.split(':').map((n) => parseInt(n, 10));
    const d = new Date(date);
    d.setHours(h || 0, m || 0, 0, 0);
    return d.toISOString();
  }, [date, endTime]);

  const handleAddGuest = (guest: GuestOption) => {
    if (guests.find((g) => g.email === guest.email)) return;
    setGuests((prev) => [...prev, guest]);
    setGuestQuery('');
    setGuestResults([]);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      return;
    }
    setSaving(true);
    try {
      const body = {
        summary: title,
        description,
        location,
        start: allDay ? format(date, 'yyyy-MM-dd') : startIso,
        end: allDay ? format(date, 'yyyy-MM-dd') : endIso,
        attendees: guests,
        allDay,
        addConference: false,
      };

      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || 'Failed to create event');
      }

      onCreated();
      onOpenChange(false);
      setTitle('');
      setDescription('');
      setLocation('');
      setGuests([]);
      setGuestQuery('');
    } catch (err: any) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[680px] max-w-[680px] gap-0 p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>
            <Heading as="h3" size="h5">
              Add event
            </Heading>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          <Input
            placeholder="Add title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-none border-0 border-b px-0 pb-2 focus-visible:ring-0"
          />

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-blue-100 bg-blue-50 text-[#1a73e8]">
              Event
            </Badge>
            <Badge variant="outline">Task</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label as="span" size="xs" tone="muted">
                Date
              </Label>
              <DatePicker
                value={format(date, 'yyyy-MM-dd')}
                onChange={(value) => {
                  if (!value) return;
                  const next = new Date(value);
                  if (!Number.isNaN(next.getTime())) {
                    setDate(next);
                  }
                }}
                clearable={false}
              />
            </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 space-y-1">
                  <Label as="span" size="xs" tone="muted">
                    Start
                  </Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  disabled={allDay}
                />
                </div>
                <div className="flex-1 space-y-1">
                  <Label as="span" size="xs" tone="muted">
                    End
                  </Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  disabled={allDay}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={allDay} onCheckedChange={setAllDay} />
                <Body as="span" tone="muted" size="xs">
                  All day
                </Body>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <Body as="span" size="sm">
                Add guests
              </Body>
            </div>
            <Input
              placeholder="Search people"
              value={guestQuery}
              onChange={(e) => setGuestQuery(e.target.value)}
            />
            {guestResults.length > 0 && (
              <div className="divide-y rounded-md border">
                {guestResults.map((g) => (
                  <button
                    key={g.email}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted"
                    onClick={() => handleAddGuest(g)}
                  >
                    <Label
                      as="span"
                      size="xs"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground"
                    >
                      {g.name?.[0]?.toUpperCase() || g.email?.[0]?.toUpperCase()}
                    </Label>
                    <div>
                      <Body as="div" size="sm">
                        {g.name || g.email}
                      </Body>
                      <Body as="div" tone="muted" size="xs">
                        {g.email}
                      </Body>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {guests.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {guests.map((g) => (
                  <Badge key={g.email} variant="secondary" className="gap-2">
                    {g.name || g.email}
                    <button
                      type="button"
                      className="text-gray-500 hover:text-gray-700"
                      onClick={() => setGuests((prev) => prev.filter((p) => p.email !== g.email))}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label as="label" size="sm" className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              <span className="flex-1">
                <Input
                  placeholder="Add location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </span>
            </Label>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlignLeft className="h-4 w-4 text-gray-500" />
                <Body as="span" size="sm">
                  Add description or attachments
                </Body>
              </div>
              <Textarea
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between border-t px-5 py-3">
          <Button
            variant="ghost"
            className="text-[#1a73e8] hover:bg-blue-50"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-[#1a73e8] hover:bg-[#1557b0]"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
