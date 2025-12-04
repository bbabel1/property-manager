'use client';

import { useEffect, useState } from 'react';
import { Loader2, StickyNote, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { fetchWithSupabaseAuth } from '@/lib/supabase/fetch';

type Note = {
  id: string;
  subject: string | null;
  body: string | null;
  created_at: string;
  created_by_name: string | null;
  is_private: boolean | null;
};

export function PropertyNotes({ propertyId }: { propertyId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchWithSupabaseAuth(`/api/properties/${propertyId}/notes?limit=20`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load notes');
      const rows: Note[] = Array.isArray(json?.data) ? json.data : [];
      setNotes(rows);
    } catch (e: any) {
      setError(e?.message || 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [propertyId]);

  async function createNote() {
    if (!subject.trim() || !body.trim()) return;
    try {
      setSubmitting(true);
      const res = await fetchWithSupabaseAuth(`/api/properties/${propertyId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), body: body.trim(), is_private: isPrivate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to create note');
      const created = json?.data as Note | undefined;
      if (created) {
        setNotes((prev) => [created, ...prev]);
      }
      setSubject('');
      setBody('');
      setIsPrivate(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to create note');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-card rounded-lg border-0 shadow-none">
      <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-6 py-4">
        <div className="flex items-center gap-2">
          <StickyNote className="text-primary h-5 w-5" />
          <h2 className="text-foreground text-lg font-semibold">Notes</h2>
        </div>
        <div>
          {loading ? (
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
          ) : (
            <Button size="sm" variant="outline" onClick={load}>
              Refresh
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-6 px-6 py-6">
        {/* Create note */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-foreground mb-1 block text-sm font-medium">Subject</label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Short subject"
              />
            </div>
            <div>
              <label className="text-foreground mb-1 block text-sm font-medium">Body</label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                placeholder="Write a note..."
              />
            </div>
            <label className="text-muted-foreground inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
              />
              Private
            </label>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={createNote}
              disabled={submitting || !subject.trim() || !body.trim()}
              className="inline-flex items-center gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}{' '}
              Add Note
            </Button>
          </div>
          {error && <div className="text-destructive text-sm">{error}</div>}
        </div>

        {/* Notes list */}
        <div className="space-y-4">
          {notes.length === 0 && !loading && (
            <div className="text-muted-foreground text-sm">No notes yet.</div>
          )}
          {notes.map((n) => {
            const date = n.created_at ? new Date(n.created_at) : null;
            return (
              <div
                key={n.id}
                className="bg-background rounded-md border border-[var(--color-border-subtle)] p-4"
              >
                <div className="mb-1 flex items-center justify-between">
                  <div className="text-foreground font-medium">{n.subject || 'Note'}</div>
                  <div className="text-muted-foreground text-xs">
                    {date ? date.toLocaleString() : ''}
                  </div>
                </div>
                {n.is_private && (
                  <Badge variant="secondary" className="text-2xs mb-2">
                    Private
                  </Badge>
                )}
                <div className="text-foreground text-sm whitespace-pre-wrap">{n.body}</div>
                {n.created_by_name && (
                  <div className="text-muted-foreground mt-2 text-xs">By {n.created_by_name}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default PropertyNotes;
