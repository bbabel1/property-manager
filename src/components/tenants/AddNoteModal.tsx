"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { Database } from '@/types/database'

type Note = Database['public']['Tables']['tenant_notes']['Row']

interface AddNoteModalProps {
  tenantId: string
  isOpen: boolean
  onClose: () => void
  onNoteAdded?: (note: Note) => void
}

export default function AddNoteModal({ 
  tenantId, 
  isOpen, 
  onClose, 
  onNoteAdded 
}: AddNoteModalProps) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = getSupabaseBrowserClient()

  const handleSave = async () => {
    if (!note.trim()) {
      toast.error('Please enter a note')
      return
    }

    try {
      setSaving(true)
      const now = new Date().toISOString()

      const { data, error } = await supabase
        .from('tenant_notes')
        .insert({ 
          tenant_id: tenantId, 
          note: note.trim(),
          created_at: now, 
          updated_at: now 
        })
        .select('*')
        .single()

      if (error) {
        throw error
      }

      toast.success('Note added successfully')
      setNote('')
      onNoteAdded?.(data as Note)
      onClose()
    } catch (error) {
      console.error('Error saving note:', error)
      toast.error('Failed to save note')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    if (!saving) {
      setNote('')
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl sm:max-w-4xl top-[35%] translate-y-[-35%]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Add note
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
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
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !note.trim()}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
