"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

type PropertyNotePayload = {
  Subject: string
  Body: string
  IsPrivate: boolean
}

type PropertyNoteResponse = {
  Id?: number
  Subject?: string
  Body?: string
  CreatedDate?: string
  CreatedByName?: string
  IsPrivate?: boolean
}

interface PropertyAddNoteModalProps {
  propertyId: string
  buildiumPropertyId: number | null
  isOpen: boolean
  onClose: () => void
  onNoteAdded?: (note: PropertyNoteResponse) => void
}

export default function PropertyAddNoteModal({ propertyId, buildiumPropertyId, isOpen, onClose, onNoteAdded }: PropertyAddNoteModalProps) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setSubject('')
    setBody('')
    setIsPrivate(false)
  }

  const handleClose = () => {
    if (saving) return
    reset()
    onClose()
  }

  const handleSave = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error('Subject and body are required')
      return
    }

    if (!buildiumPropertyId) {
      toast.error('This property is not linked to Buildium yet.')
      return
    }

    const payload: PropertyNotePayload = {
      Subject: subject.trim(),
      Body: body.trim(),
      IsPrivate: isPrivate,
    }

    try {
      setSaving(true)
      const res = await fetch(`/api/buildium/properties/${buildiumPropertyId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to create note')

      toast.success('Note added successfully')
      const created: PropertyNoteResponse = json?.data || payload
      onNoteAdded?.(created)
      reset()
      onClose()
    } catch (error) {
      console.error('Failed to create property note', error)
      toast.error('Failed to create note')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl sm:max-w-4xl top-[35%] translate-y-[-35%]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">Add property note</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="property-note-subject" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
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
            <Label htmlFor="property-note-body" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
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
            <Switch id="property-note-private" checked={isPrivate} onCheckedChange={setIsPrivate} disabled={saving} />
            <Label htmlFor="property-note-private" className="text-sm text-muted-foreground">
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
  )
}
