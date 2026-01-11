'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, PencilLine, Trash2, Eye } from 'lucide-react';
import ActionButton from '@/components/ui/ActionButton';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import AddNoteModal from '@/components/tenants/AddNoteModal';
import { fetchWithSupabaseAuth } from '@/lib/supabase/fetch';

type Note = Database['public']['Tables']['tenant_notes']['Row'];

interface TenantNotesTableProps {
  tenantId: string;
}

export default function TenantNotesTable({ tenantId }: TenantNotesTableProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = getSupabaseBrowserClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [formNote, setFormNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

  const fetchNotes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('tenant_notes')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setNotes(data || []);
    } catch (err) {
      console.error('Error fetching notes:', err);
      setError('Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, [supabase, tenantId]);

  useEffect(() => {
    void fetchNotes();
  }, [fetchNotes]);

  const openEdit = (note: Note) => {
    setEditing(note);
    setFormNote(note.note ?? '');
    setDialogOpen(true);
  };

  const saveNote = async () => {
    try {
      setSaving(true);
      const now = new Date().toISOString();

      if (editing) {
        const optimistic: Note = { ...editing, note: formNote || '', updated_at: now };
        setNotes((prev) => prev.map((n) => (n.id === optimistic.id ? optimistic : n)));
        const { error } = await supabase
          .from('tenant_notes')
          .update({ note: optimistic.note, updated_at: optimistic.updated_at })
          .eq('id', optimistic.id);
        if (error) throw error;
        toast.success('Note updated');
        setDialogOpen(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save note');
      // refresh to undo optimistic error state
      fetchNotes();
    } finally {
      setSaving(false);
    }
  };

  const deleteNote = async (id: string) => {
    const existing = notes.find((n) => n.id === id);
    if (!existing) return;
    // optimistic remove
    setNotes((prev) => prev.filter((n) => n.id !== id));
    try {
      const res = await fetchWithSupabaseAuth(`/api/tenants/${tenantId}/notes/${id}`, {
        method: 'DELETE',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to delete');
      }
      if (json?.buildium_sync_error) {
        toast.warning('Note deleted locally, but Buildium removal failed', {
          description: json.buildium_sync_error,
        });
      } else {
        toast.success('Note deleted');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
      // restore
      setNotes((prev) => [existing, ...prev]);
    }
  };

  const handleExport = () => {
    if (!notes.length) {
      toast.info('No notes to export');
      return;
    }
    const headers = ['Created At', 'Updated At', 'Note'];
    const rows = notes.map((note) => [
      note.created_at ?? '',
      note.updated_at ?? '',
      (note.note ?? '').replace(/\r?\n/g, ' '),
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tenant-notes-${tenantId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Notes exported');
  };

  const filteredNotes = notes;

  return (
    <div className="border-border bg-background rounded-lg border shadow-sm">
      {/* Controls (match Files panel layout) */}
      <div className="border-border flex flex-col gap-4 border-b px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
          <select
            className="border-input bg-background focus-visible:ring-primary h-9 rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none"
            aria-label="Filter by category"
          >
            <option>All categories</option>
          </select>
          <button type="button" className="text-primary hover:underline">
            Add filter option
          </button>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setAddModalOpen(true)}>Add note</Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {/* Matches label */}
      <div className="text-muted-foreground px-4 py-3 text-xs">
        {loading
          ? '0 matches'
          : `${filteredNotes.length} match${filteredNotes.length === 1 ? '' : 'es'}`}
      </div>

      {/* Table Content */}
      {error ? (
        <div className="border-border border-t px-4 py-6 text-center">
          <div className="text-destructive">
            <p className="text-sm">{error}</p>
          </div>
        </div>
      ) : loading || filteredNotes.length === 0 ? (
        <div className="border-border text-muted-foreground border-t px-4 py-6 text-sm">
          You don't have any notes for this tenant right now.{' '}
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="text-primary align-baseline text-sm font-normal hover:underline"
            disabled={loading}
          >
            Add your first note
          </button>
        </div>
      ) : (
        <div className="border-border border-t">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">Date</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="w-28">Source</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredNotes.map((note) => (
                <TableRow key={note.id}>
                  <TableCell className="text-sm">
                    {new Date(note.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="text-foreground line-clamp-2 text-sm" title={note.note || ''}>
                      {note.note || '—'}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {note.buildium_note_id ? 'Buildium' : 'Private'}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <ActionButton aria-label="Actions" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => openEdit(note)}>
                          <PencilLine className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            toast.info('Note preview', {
                              description: note.note || 'No content',
                            })
                          }
                        >
                          <Eye className="mr-2 h-4 w-4" /> View
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => setNoteToDelete(note)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          {/* Hidden trigger to allow programmatic open via state */}
          <span className="hidden" />
        </DialogTrigger>
        <DialogContent className="top-[35%] w-[680px] max-w-[680px] translate-y-[-35%]">
          <DialogHeader>
            <DialogTitle className="text-foreground text-lg font-semibold">
              {editing ? 'Edit note' : 'Add note'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-muted-foreground mb-2 block text-xs font-medium tracking-wider uppercase">
                NOTE
              </label>
              <Textarea
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
                placeholder="Enter your note here..."
                className="min-h-[120px] resize-y"
                disabled={saving}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveNote} disabled={saving || !formNote.trim()}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AddNoteModal
        tenantId={tenantId}
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onNoteAdded={(newNote) => {
          setNotes((prev) => [newNote, ...prev]);
        }}
      />

      <AlertDialog
        open={!!noteToDelete}
        onOpenChange={(open) => {
          if (!open) setNoteToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete note?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (noteToDelete) {
                  void deleteNote(noteToDelete.id);
                }
                setNoteToDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
