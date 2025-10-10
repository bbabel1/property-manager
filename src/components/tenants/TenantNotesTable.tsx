"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChevronDown, Download, Plus, PencilLine, Trash2, MoreHorizontal, Eye } from 'lucide-react'
import ActionButton from '@/components/ui/ActionButton'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import AddNoteModal from '@/components/tenants/AddNoteModal'

type Note = Database['public']['Tables']['tenant_notes']['Row']

interface TenantNotesTableProps {
  tenantId: string
}

export default function TenantNotesTable({ tenantId }: TenantNotesTableProps) {
  const [filterValue, setFilterValue] = useState('')
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = getSupabaseBrowserClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Note | null>(null)
  const [formNote, setFormNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)

  useEffect(() => {
    fetchNotes()
  }, [tenantId])

  const fetchNotes = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('tenant_notes')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      setNotes(data || [])
    } catch (err) {
      console.error('Error fetching notes:', err)
      setError('Failed to load notes')
    } finally {
      setLoading(false)
    }
  }


  const openEdit = (note: Note) => {
    setEditing(note)
    setFormNote(note.note ?? '')
    setDialogOpen(true)
  }

  const saveNote = async () => {
    try {
      setSaving(true)
      const now = new Date().toISOString()

      if (editing) {
        const optimistic: Note = { ...editing, note: formNote || '', updated_at: now }
        setNotes((prev) => prev.map((n) => (n.id === optimistic.id ? optimistic : n)))
        const { error } = await supabase
          .from('tenant_notes')
          .update({ note: optimistic.note, updated_at: optimistic.updated_at })
          .eq('id', optimistic.id)
        if (error) throw error
        toast.success('Note updated')
        setDialogOpen(false)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save note')
      // refresh to undo optimistic error state
      fetchNotes()
    } finally {
      setSaving(false)
    }
  }

  const deleteNote = async (id: string) => {
    const existing = notes.find((n) => n.id === id)
    if (!existing) return
    // optimistic remove
    setNotes((prev) => prev.filter((n) => n.id !== id))
    try {
      const { error } = await supabase.from('tenant_notes').delete().eq('id', id)
      if (error) throw error
      toast.success('Note deleted')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete')
      // restore
      setNotes((prev) => [existing, ...prev])
    }
  }

  const handleExport = () => {
    // TODO: Implement export functionality
    console.log('Export clicked')
  }

  const filteredNotes = notes.filter((note) => {
    const q = filterValue.trim().toLowerCase()
    if (!q) return true
    return (note.note || '').toLowerCase().includes(q)
  })

  return (
    <div className="rounded-lg border border-border bg-background shadow-sm">
      {/* Controls (match Files panel layout) */}
      <div className="flex flex-col gap-4 border-b border-border px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <select 
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Filter by category"
          >
            <option>All categories</option>
          </select>
          <button type="button" className="text-primary hover:underline">Add filter option</button>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setAddModalOpen(true)}>Add note</Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {/* Matches label */}
      <div className="px-4 py-3 text-xs text-muted-foreground">
        {loading ? '0 matches' : `${filteredNotes.length} match${filteredNotes.length === 1 ? '' : 'es'}`}
      </div>

      {/* Table Content */}
      {error ? (
        <div className="border-t border-border px-4 py-6 text-center">
          <div className="text-destructive">
            <p className="text-sm">{error}</p>
          </div>
        </div>
      ) : loading || filteredNotes.length === 0 ? (
        <div className="border-t border-border px-4 py-6 text-sm text-muted-foreground">
          You don't have any notes for this tenant right now.{' '}
          <button
            type="button"
            onClick={() => setAddModalOpen(true)}
            className="text-primary hover:underline text-sm font-normal align-baseline"
            disabled={loading}
          >
            Add your first note
          </button>
        </div>
      ) : (
        <div className="border-t border-border">
          <Table>
              <TableHeader className="bg-muted/50">
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
                  <TableCell className="text-sm">{new Date(note.created_at).toLocaleDateString()}</TableCell>
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
                          <DropdownMenuItem onClick={() => openEdit(note)}>
                            <PencilLine className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => alert(note.note || '')}>
                            <Eye className="mr-2 h-4 w-4" /> View
                          </DropdownMenuItem>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem className="text-destructive focus:text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete note?</AlertDialogTitle>
                                <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteNote(note.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
        <DialogContent className="max-w-3xl sm:max-w-4xl top-[35%] translate-y-[-35%]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">
              {editing ? 'Edit note' : 'Add note'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
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
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={saveNote}
              disabled={saving || !formNote.trim()}
            >
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
          setNotes(prev => [newNote, ...prev])
        }}
      />
    </div>
  )
}
