"use client"

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, StickyNote, Plus } from 'lucide-react'

type Note = {
  Id?: number
  Subject?: string
  Body?: string
  CreatedDate?: string
  CreatedByName?: string
  IsPrivate?: boolean
}

export function PropertyNotes({ propertyId }: { propertyId: string }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/buildium/properties/${propertyId}/notes?limit=20&orderby=CreatedDate desc`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to load notes')
      const rows: Note[] = Array.isArray(json?.data) ? json.data : []
      setNotes(rows)
    } catch (e: any) {
      setError(e?.message || 'Failed to load notes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [propertyId])

  async function createNote() {
    if (!subject.trim() || !body.trim()) return
    try {
      setSubmitting(true)
      const res = await fetch(`/api/buildium/properties/${propertyId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Subject: subject.trim(), Body: body.trim(), IsPrivate: isPrivate }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to create note')
      const created: Note = json?.data
      setNotes((prev) => [created, ...prev])
      setSubject('')
      setBody('')
      setIsPrivate(false)
    } catch (e: any) {
      setError(e?.message || 'Failed to create note')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="p-6 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StickyNote className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Notes</h2>
        </div>
        <div>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Button size="sm" variant="outline" onClick={load}>
              Refresh
            </Button>
          )}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Create note */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Subject</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short subject" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Body</label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Write a note..." />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
              Private
            </label>
          </div>
          <div className="flex justify-end">
            <Button onClick={createNote} disabled={submitting || !subject.trim() || !body.trim()} className="inline-flex items-center gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add Note
            </Button>
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
        </div>

        {/* Notes list */}
        <div className="space-y-4">
          {notes.length === 0 && !loading && (
            <div className="text-sm text-muted-foreground">No notes yet.</div>
          )}
          {notes.map((n) => {
            const date = n.CreatedDate ? new Date(n.CreatedDate) : null
            return (
              <div key={String(n.Id ?? `${n.Subject}-${n.CreatedDate}`)} className="border border-border rounded-md p-4 bg-background">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-medium text-foreground">{n.Subject || 'Note'}</div>
                  <div className="text-xs text-muted-foreground">
                    {date ? date.toLocaleString() : ''}
                  </div>
                </div>
                {n.IsPrivate && <Badge variant="secondary" className="text-2xs mb-2">Private</Badge>}
                <div className="text-sm text-foreground whitespace-pre-wrap">{n.Body}</div>
                {n.CreatedByName && (
                  <div className="text-xs text-muted-foreground mt-2">By {n.CreatedByName}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default PropertyNotes
