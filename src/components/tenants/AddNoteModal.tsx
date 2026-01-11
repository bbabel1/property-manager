'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { fetchWithSupabaseAuth } from '@/lib/supabase/fetch';
import type { Database } from '@/types/database';

type Note = Database['public']['Tables']['tenant_notes']['Row'];

interface AddNoteModalProps {
  tenantId: string;
  isOpen: boolean;
  onClose: () => void;
  onNoteAdded?: (note: Note) => void;
}

export default function AddNoteModal({
  tenantId,
  isOpen,
  onClose,
  onNoteAdded,
}: AddNoteModalProps) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!note.trim()) {
      toast.error('Please enter a note');
      return;
    }

    try {
      setSaving(true);

      // Call API route that handles both local save and Buildium sync
      const res = await fetchWithSupabaseAuth(`/api/tenants/${tenantId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note.trim() }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || 'Failed to create note');
      }

      // Show warning if Buildium sync failed but local save succeeded
      if (json.buildium_sync_error) {
        toast.warning('Note saved locally, but failed to sync to Buildium', {
          description: json.buildium_sync_error,
        });
      } else {
        toast.success('Note added successfully and synced to Buildium');
      }

      const createdNote = json.data as Note;
      setNote('');
      onNoteAdded?.(createdNote);
      onClose();
    } catch (error) {
      console.error('Error saving note:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save note';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setNote('');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="top-[35%] w-[680px] max-w-[680px] translate-y-[-35%]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-lg font-semibold">Add note</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-muted-foreground mb-2 block text-xs font-medium tracking-wider uppercase">
              NOTE
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Enter your note here..."
              className="min-h-[120px] resize-y"
              disabled={saving}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !note.trim()}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
