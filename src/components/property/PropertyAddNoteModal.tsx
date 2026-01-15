'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { fetchWithSupabaseAuth } from '@/lib/supabase/fetch';
import { Label } from '@/ui/typography';

type PropertyNotePayload = {
  subject: string;
  body: string;
  is_private: boolean;
};

type PropertyNoteResponse = {
  id: string;
  subject: string | null;
  body: string | null;
  created_at: string;
  created_by_name: string | null;
  is_private: boolean | null;
};

interface PropertyAddNoteModalProps {
  propertyId: string;
  isOpen: boolean;
  onClose: () => void;
  onNoteAdded?: (note: PropertyNoteResponse) => void;
}

export default function PropertyAddNoteModal({
  propertyId,
  isOpen,
  onClose,
  onNoteAdded,
}: PropertyAddNoteModalProps) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setSubject('');
    setBody('');
    setIsPrivate(false);
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error('Subject and body are required');
      return;
    }

    if (!propertyId) {
      toast.error('Property is required before adding notes.');
      return;
    }

    const payload: PropertyNotePayload = {
      subject: subject.trim(),
      body: body.trim(),
      is_private: isPrivate,
    };

    try {
      setSaving(true);
      const res = await fetchWithSupabaseAuth(`/api/properties/${propertyId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to create note');

      toast.success('Note added successfully');
      const created = json?.data as PropertyNoteResponse | undefined;
      if (created) {
        onNoteAdded?.(created);
      }
      reset();
      onClose();
    } catch (error) {
      console.error('Failed to create property note', error);
      toast.error('Failed to create note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="top-[35%] w-[680px] max-w-[680px] translate-y-[-35%]">
        <DialogHeader>
          <DialogTitle headingAs="h2" headingSize="h4">
            Add property note
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label
              as="label"
              htmlFor="property-note-subject"
              size="xs"
              tone="muted"
              className="font-medium tracking-wide uppercase"
            >
              Subject
            </Label>
            <Input
              id="property-note-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Short summary"
              disabled={saving}
              className="mt-2"
            />
          </div>
          <div>
            <Label
              as="label"
              htmlFor="property-note-body"
              size="xs"
              tone="muted"
              className="font-medium tracking-wide uppercase"
            >
              Note
            </Label>
            <Textarea
              id="property-note-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Enter note details..."
              className="mt-2 min-h-[120px] resize-y"
              disabled={saving}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="property-note-private"
              checked={isPrivate}
              onCheckedChange={setIsPrivate}
              disabled={saving}
            />
            <Label as="label" htmlFor="property-note-private" size="sm" tone="muted">
              Mark as private
            </Label>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !subject.trim() || !body.trim()}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
