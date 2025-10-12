"use client"

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import PropertyAddNoteModal from '@/components/property/PropertyAddNoteModal'

type PropertyNote = {
  Id?: number
  Subject?: string
  Body?: string
  CreatedDate?: string
  CreatedByName?: string
  IsPrivate?: boolean
}

interface PropertyRecentNotesSectionProps {
  propertyId: string
  buildiumPropertyId: number | null
}

function formatDateTime(value?: string) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleString()
  } catch {
    return '—'
  }
}

export default function PropertyRecentNotesSection({ propertyId, buildiumPropertyId }: PropertyRecentNotesSectionProps) {
  const [notes, setNotes] = useState<PropertyNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    if (!buildiumPropertyId) {
      setNotes([])
      setLoading(false)
      return
    }
    fetchNotes(buildiumPropertyId)
  }, [propertyId, buildiumPropertyId])

  async function fetchNotes(buildiumId: number) {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/buildium/properties/${buildiumId}/notes?limit=5&orderby=CreatedDate desc`, {
        cache: 'no-store',
        credentials: 'include'
      })
      if (!res.ok) {
        let message = 'Unable to load property notes'
        try {
          const json = await res.json()
          if (json?.error) message = json.error
        } catch {}
        setError(message)
        setNotes([])
        return
      }
      const json = await res.json()
      const rows: PropertyNote[] = Array.isArray(json?.data) ? json.data : []
      setNotes(rows)
    } catch (err: any) {
      console.error('Failed to load property notes', err)
      setError(err?.message || 'Failed to load notes')
      setNotes([])
    } finally {
      setLoading(false)
    }
  }

  const handleNoteAdded = (note: PropertyNote) => {
    setNotes((prev) => [note, ...prev].slice(0, 5))
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">Recent notes</h2>
          <Button
            variant="link"
            className="px-2 py-0 h-auto"
            onClick={() => buildiumPropertyId && setModalOpen(true)}
            disabled={!buildiumPropertyId}
          >
            Add
          </Button>
        </div>
        <div className="rounded-lg border border-border bg-background shadow-sm">
          {!buildiumPropertyId ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">Notes are available after this property is linked to Buildium.</div>
          ) : loading ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">Loading recent notes...</div>
          ) : error ? (
            <div className="px-4 py-6 text-center text-sm text-destructive">{error}</div>
          ) : notes.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              You don't have any notes for this property right now.{' '}
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
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/3">Date</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="w-32">Visibility</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border">
                {notes.map((note) => (
                  <TableRow key={String(note.Id ?? note.CreatedDate)}>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(note.CreatedDate)}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium text-foreground">{note.Subject || 'Note'}</div>
                      <div className="text-sm text-muted-foreground line-clamp-2" title={note.Body || ''}>
                        {note.Body || '—'}
                      </div>
                      {note.CreatedByName ? (
                        <div className="mt-1 text-xs text-muted-foreground">By {note.CreatedByName}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{note.IsPrivate ? 'Private' : 'Shared'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <PropertyAddNoteModal
        propertyId={propertyId}
        buildiumPropertyId={buildiumPropertyId}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onNoteAdded={handleNoteAdded}
      />
    </>
  )
}
