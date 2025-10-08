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
  actionsPlacement = 'header',
  onClose,
  titleHidden = false,
  size = 'default',
  headerHidden = false,
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
  actionsPlacement?: 'header' | 'footer'
  onClose?: () => void
  titleHidden?: boolean
  size?: 'default' | 'compact'
  headerHidden?: boolean
}) {
  const hasBgOverride = Boolean(className && /\bbg-\[/i.test(className))
  const containerBase = variant === 'plain'
    ? `rounded-lg border border-transparent shadow-none ${hasBgOverride ? '' : 'bg-transparent'}`
    : `rounded-lg border border-border ${hasBgOverride ? '' : 'bg-card'}`
  const headerPad = size === 'compact' ? 'px-3 py-2' : 'px-4 py-3'
  const headerBase = variant === 'plain'
    ? `flex items-center justify-between ${headerPad}`
    : `flex items-center justify-between ${headerPad} border-b border-border`
  const contentPad = size === 'compact' ? 'p-3' : 'p-4'
  return (
    <div className={`${containerBase} relative ${className ?? ''}`}>
      {!headerHidden && (
        <div className={headerBase}>
          {titleHidden ? <div /> : <h2 className="text-base font-semibold text-foreground">{title}</h2>}
          {!editing ? (
            <Button variant="outline" size="sm" onClick={onEdit} aria-label="Edit">
              <Edit className="h-4 w-4 mr-2"/>Edit
            </Button>
          ) : (
            actionsPlacement === 'header' ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onCancel}><X className="h-4 w-4 mr-2"/>Cancel</Button>
                <Button size="sm" onClick={onSave} disabled={isSaving || !canSave}>
                  <Save className="h-4 w-4 mr-2"/>{isSaving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            ) : (
              // Footer actions mode: show only a close icon on the header (top-right)
              <button type="button" aria-label="Close" onClick={onClose || onCancel} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            )
          )}
        </div>
      )}
      {/* If header is hidden but we still want a close affordance, place an absolute X */}
      {headerHidden && editing && actionsPlacement === 'footer' && (
        <button type="button" aria-label="Close" onClick={onClose || onCancel} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      )}
      <div className={contentPad}>
        {editing ? edit : view}
        {editing && actionsPlacement === 'footer' && (
          <div className={`${size === 'compact' ? 'mt-4' : 'mt-6'} flex items-center gap-4`}>
            <Button onClick={onSave} disabled={isSaving || !canSave}>{isSaving ? 'Saving…' : 'Save'}</Button>
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          </div>
        )}
      </div>
    </div>
  )
}
