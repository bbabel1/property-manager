"use client"

import { ReactNode } from "react"
import { Heading } from "@/ui/typography"

export default function RepeaterField({ title, header, children, onAdd, addLabel = 'Add row' }: {
  title?: string
  header?: ReactNode
  children: ReactNode
  onAdd?: () => void
  addLabel?: string
}) {
  return (
    <div>
      {title && (
        <Heading as="h4" size="h6" className="mb-2 font-medium text-foreground">
          {title}
        </Heading>
      )}
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
