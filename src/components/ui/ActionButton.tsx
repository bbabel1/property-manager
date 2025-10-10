"use client"

import React from 'react'
import { Button } from '@/components/ui/button'
import { MoreHorizontal } from 'lucide-react'

type Props = React.ComponentProps<'button'> & {
  children?: React.ReactNode
  icon?: React.ReactNode
}

export default function ActionButton({ children, icon = <MoreHorizontal className="h-4 w-4" />, className = '', ...props }: Props) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-8 w-8 p-0 rounded-full border border-border hover:bg-muted ${className}`}
      {...props}
    >
      {children || icon}
    </Button>
  )
}
