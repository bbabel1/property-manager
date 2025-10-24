'use client'

import { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

type EditFormPanelProps = {
  children: ReactNode
  onClose?: () => void
  className?: string
  contentClassName?: string
}

export default function EditFormPanel({
  children,
  onClose,
  className,
  contentClassName,
}: EditFormPanelProps) {
  return (
    <Card
      className={cn(
        'relative overflow-hidden border border-border border-l-2 border-l-primary bg-white shadow-lg',
        className,
      )}
    >
      <CardContent
        className={cn(
          'relative p-6',
          onClose ? 'pt-12 pr-12' : null,
          contentClassName,
        )}
      >
        <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-primary" />
        {onClose ? (
          <button
            type="button"
            aria-label="Close edit form"
            onClick={onClose}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-muted/40 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        ) : null}
        <div className="space-y-6">{children}</div>
      </CardContent>
    </Card>
  )
}
