"use client"

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { PencilLine, Trash2, Eye } from 'lucide-react'
import ActionButton from '@/components/ui/ActionButton'
import AddNoteModal from '@/components/tenants/AddNoteModal'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
import { toast } from 'sonner'
import { fetchWithSupabaseAuth } from '@/lib/supabase/fetch'

type Note = Database['public']['Tables']['tenant_notes']['Row']

interface RecentNotesSectionProps {
  tenantId: string
}

const formatDateTime = (dateString: string): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(dateString))
}

export default function RecentNotesSection({ tenantId }: RecentNotesSectionProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null)
  const supabase = getSupabaseBrowserClient()

  const fetchRecentNotes = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Get date 90 days ago
      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
      const ninetyDaysAgoISO = ninetyDaysAgo.toISOString()

      const { data, error } = await supabase
        .from('tenant_notes')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('created_at', ninetyDaysAgoISO)
        .order('created_at', { ascending: false })
        .limit(5) // Show only the 5 most recent notes

      if (error) {
        throw error
      }

      setNotes(data || [])
    } catch (err) {
      console.error('Error fetching recent notes:', err)
      setError('Failed to load recent notes')
    } finally {
      setLoading(false)
    }
  }, [supabase, tenantId])

  useEffect(() => {
    void fetchRecentNotes()
  }, [fetchRecentNotes])

  const deleteNote = async (id: string) => {
    const existing = notes.find((n) => n.id === id)
    if (!existing) return

    // Optimistically remove
    setNotes((prev) => prev.filter((n) => n.id !== id))

    try {
      const res = await fetchWithSupabaseAuth(`/api/tenants/${tenantId}/notes/${id}`, {
        method: 'DELETE'
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json?.error || 'Failed to delete note')
      }
      if (json?.buildium_sync_error) {
        toast.warning('Note deleted locally, but Buildium removal failed', {
          description: json.buildium_sync_error
        })
      } else {
        toast.success('Note deleted')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete note')
      // Restore previous state if delete failed
      setNotes((prev) => [existing, ...prev])
    }
  }

  const handleNoteAdded = (newNote: Note) => {
    setNotes(prev => [newNote, ...prev])
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">Recent notes</h2>
          <Button 
            variant="link" 
            className="px-2 py-0 h-auto"
            onClick={() => setModalOpen(true)}
          >
            Add
          </Button>
        </div>
        <div className="rounded-lg border border-border bg-background shadow-sm overflow-hidden">

        {loading ? (
          <div className="px-4 py-6 text-sm text-muted-foreground text-center">
            Loading recent notes...
          </div>
        ) : error ? (
          <div className="px-4 py-6 text-sm text-destructive text-center">
            {error}
          </div>
        ) : notes.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            You don't have any notes for this tenant right now.{' '}
            <Button 
              variant="link" 
              className="px-1 py-0 h-auto"
              onClick={() => setModalOpen(true)}
            >
              Add your first note
            </Button>
          </div>
        ) : (
          <Table>
            <TableBody className="divide-y divide-border">
              {notes.map((note) => (
                <TableRow key={note.id} className="hover:bg-muted/40">
                  <TableCell className="text-sm">{formatDateTime(note.created_at)}</TableCell>
                  <TableCell>
                    <div className="text-sm text-foreground line-clamp-2" title={note.note || ''}>{note.note || '—'}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{note.buildium_note_id ? 'Buildium' : 'Private'}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <ActionButton aria-label="Actions" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => setModalOpen(true)}>
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
        )}
        </div>
      </div>

      <AddNoteModal
        tenantId={tenantId}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onNoteAdded={handleNoteAdded}
      />

      <AlertDialog
        open={!!noteToDelete}
        onOpenChange={(open) => {
          if (!open) setNoteToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete note?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (noteToDelete) {
                  void deleteNote(noteToDelete.id)
                }
                setNoteToDelete(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
