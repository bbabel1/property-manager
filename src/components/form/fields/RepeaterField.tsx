"use client"

import { ReactNode } from "react"

export default function RepeaterField({ title, header, children, onAdd, addLabel = 'Add row' }: {
  title?: string
  header?: ReactNode
  children: ReactNode
  onAdd?: () => void
  addLabel?: string
}) {
  return (
    <div>
      {title && <h4 className="text-sm font-medium text-foreground mb-2">{title}</h4>}
      {header}
      <div className="space-y-2">{children}</div>
      {onAdd && (
        <div className="pt-1">
          <button type="button" onClick={onAdd} className="text-primary text-sm underline">+ {addLabel}</button>
        </div>
      )}
    </div>
  )
}

