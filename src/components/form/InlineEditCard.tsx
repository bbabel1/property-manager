"use client"

import { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Edit, X, Save } from "lucide-react"

export default function InlineEditCard({
  title,
  editing,
  onEdit,
  onCancel,
  onSave,
  isSaving,
  canSave = true,
  view,
  edit,
  className,
  variant = 'card',
}: {
  title: string
  editing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  isSaving?: boolean
  canSave?: boolean
  view: ReactNode
  edit: ReactNode
  className?: string
  variant?: 'card' | 'plain'
}) {
  const hasBgOverride = Boolean(className && /\bbg-\[/i.test(className))
  const containerBase = variant === 'plain'
    ? `rounded-lg border border-transparent shadow-none ${hasBgOverride ? '' : 'bg-transparent'}`
    : `rounded-lg border border-border ${hasBgOverride ? '' : 'bg-card'}`
  const headerBase = variant === 'plain'
    ? 'flex items-center justify-between px-4 py-3'
    : 'flex items-center justify-between px-4 py-3 border-b border-border'
  return (
    <div className={`${containerBase} ${className ?? ''}`}>
      <div className={headerBase}>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {!editing ? (
          <Button variant="outline" size="sm" onClick={onEdit} aria-label="Edit">
            <Edit className="h-4 w-4 mr-2"/>Edit
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onCancel}><X className="h-4 w-4 mr-2"/>Cancel</Button>
            <Button size="sm" onClick={onSave} disabled={isSaving || !canSave}>
              <Save className="h-4 w-4 mr-2"/>{isSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        )}
      </div>
      <div className="p-4">
        {editing ? edit : view}
      </div>
    </div>
  )
}
