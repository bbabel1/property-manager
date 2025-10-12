"use client"

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Edit2 } from 'lucide-react'

export default function TenantMoveInEditor({
  contactId,
  value,
}: {
  contactId: string
  value: string | null
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [date, setDate] = useState<string>(value ? toInput(value) : '')
  const [pending, startTransition] = useTransition()
  const [err, setErr] = useState<string | null>(null)

  const onSave = async () => {
    setErr(null)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/lease-contacts/${contactId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ move_in_date: date || null }),
        })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j?.error || 'Failed to update')
        setEditing(false)
        router.refresh()
      } catch (e: any) {
        setErr(e?.message || 'Failed to update')
      }
    })
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {value ? <span>Move-in {value}</span> : <span>Move-in —</span>}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-primary"
          aria-label="Edit move-in date"
          onClick={() => setEditing(true)}
        >
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <input
        type="date"
        className="h-7 rounded border border-input bg-background px-2 text-foreground"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        aria-label="Move-in date"
      />
      <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditing(false)}>
        Cancel
      </Button>
      <Button size="sm" disabled={pending} onClick={onSave}>
        Save
      </Button>
      {err ? <span className="ml-2 text-destructive">{err}</span> : null}
    </div>
  )
}

function toInput(display: string) {
  // display expected like M/D/YYYY or locale; attempt to parse
  const d = new Date(display)
  if (Number.isNaN(d.getTime())) return ''
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

