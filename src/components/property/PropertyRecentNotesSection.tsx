'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import PropertyAddNoteModal from '@/components/property/PropertyAddNoteModal';
import { fetchWithSupabaseAuth } from '@/lib/supabase/fetch';
import { Body, Heading, Label } from '@/ui/typography';

type PropertyNote = {
  id: string;
  subject: string | null;
  body: string | null;
  created_at: string;
  created_by_name: string | null;
  is_private: boolean | null;
};

interface PropertyRecentNotesSectionProps {
  propertyId: string;
}

function formatDateTime(value?: string) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
}

export default function PropertyRecentNotesSection({
  propertyId,
}: PropertyRecentNotesSectionProps) {
  const [notes, setNotes] = useState<PropertyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchNotes(propertyId);
  }, [propertyId]);

  async function fetchNotes(propId: string) {
    if (!propId) {
      setNotes([]);
      setExpandedNotes({});
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetchWithSupabaseAuth(`/api/properties/${propId}/notes?limit=5`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        setNotes([]);
        setExpandedNotes({});
        return;
      }
      const json = await res.json();
      const rows: PropertyNote[] = Array.isArray(json?.data) ? json.data : [];
      setNotes(rows);
      setExpandedNotes({});
    } catch (err: unknown) {
      console.error('Failed to load property notes', err);
      setNotes([]);
      setExpandedNotes({});
    } finally {
      setLoading(false);
    }
  }

  const handleNoteAdded = (note: PropertyNote) => {
    setNotes((prev) => [note, ...prev].slice(0, 5));
    setExpandedNotes((prev) => ({ ...prev, [note.id]: true }));
  };

  const toggleNoteExpansion = (id: string) => {
    setExpandedNotes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <>
      <div className="space-y-4">
        <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-border-strong pb-3">
          <Heading as="h2" size="h5" className="text-lg font-semibold text-foreground">
            Recent notes
          </Heading>
          <Button
            variant="link"
            className="px-2"
            onClick={() => propertyId && setModalOpen(true)}
            disabled={!propertyId}
          >
            Add
          </Button>
        </div>
        <div className="rounded-lg border border-border bg-card">
          {!propertyId ? (
            <Body as="div" tone="muted" size="sm" className="px-4 py-6">
              Notes are available after this property is saved.
            </Body>
          ) : loading ? (
            <Body as="div" tone="muted" size="sm" className="px-4 py-6 text-center">
              Loading recent notes...
            </Body>
          ) : notes.length === 0 ? (
            <Body as="div" tone="muted" size="sm" className="px-4 py-6">
              You don't have any notes for this property right now.{' '}
              <Button variant="link" className="px-1" onClick={() => setModalOpen(true)}>
                Add your first note
              </Button>
            </Body>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/3">Date</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="w-32">Visibility</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border-subtle">
                {notes.map((note) => (
                  <TableRow key={note.id}>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDateTime(note.created_at)}
                    </TableCell>
                    <TableCell>
                      <Label as="div" size="sm">
                        {note.subject || 'Note'}
                      </Label>
                      <div
                        className={`text-muted-foreground text-sm ${expandedNotes[note.id] ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}
                      >
                        {note.body || '—'}
                      </div>
                      {note.body && note.body.length > 140 ? (
                        <button
                          type="button"
                          onClick={() => toggleNoteExpansion(note.id)}
                          className="text-primary focus-visible:ring-offset-background mt-1 inline-flex min-h-[2.75rem] items-center rounded-md px-1 py-1 text-sm font-[var(--font-weight-medium)] underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:outline-none"
                        >
                          {expandedNotes[note.id] ? 'Show less' : 'View more'}
                        </button>
                      ) : null}
                      {note.created_by_name ? (
                        <div className="text-muted-foreground mt-1 text-xs">
                          By {note.created_by_name}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {note.is_private ? 'Private' : 'Shared'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <PropertyAddNoteModal
        propertyId={propertyId}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onNoteAdded={handleNoteAdded}
      />
    </>
  );
}
