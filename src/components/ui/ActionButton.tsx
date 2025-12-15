"use client"

import React from 'react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { MoreHorizontal } from 'lucide-react'
import { cn } from '@/components/ui/utils'

type Props = ButtonProps & {
  children?: React.ReactNode
  icon?: React.ReactNode
}

export default function ActionButton({ children, icon = <MoreHorizontal className="h-4 w-4" />, className = '', ...props }: Props) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        'h-8 w-8 p-0 rounded-full border border-border bg-muted text-muted-foreground hover:!bg-muted/80 transition-colors',
        className,
      )}
      {...props}
    >
      {children || icon}
    </Button>
  )
}
