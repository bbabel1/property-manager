"use client"

import React from 'react'

type Props = React.ComponentProps<'button'> & { label?: string }

export default function AddLink({ label = 'Add', className = '', ...props }: Props) {
  return (
    <button
      type="button"
      {...props}
      className={`text-primary hover:underline px-0 py-0 h-auto bg-transparent text-sm ${className}`}
      aria-label={props['aria-label'] || `Add ${label.toLowerCase()}`}
    >
      {label}
    </button>
  )
}
