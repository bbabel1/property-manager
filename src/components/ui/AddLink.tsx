"use client"

import React from 'react'

type Props = React.ComponentProps<'button'> & { label?: string }

const BASE_CLASSES =
  'inline-flex items-center justify-center gap-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-primary transition-colors min-h-[2.75rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background hover:bg-primary/10 dark:hover:bg-primary/20'

export default function AddLink({ label = 'Add', className = '', ...props }: Props) {
  return (
    <button
      type="button"
      {...props}
      className={`${BASE_CLASSES} ${className}`}
      aria-label={props['aria-label'] || `Add ${label.toLowerCase()}`}
    >
      {label}
    </button>
  )
}
