"use client"

import { cn } from './utils'

export function FormStatus({ type, message, className }: { type: 'success'|'error'|'info'; message: string; className?: string }) {
  const base = 'text-sm rounded-md border px-3 py-2'
  const styles = type === 'success'
    ? 'bg-[var(--color-action-50)] border-[var(--color-action-200)] text-[var(--color-action-600)]'
    : type === 'error'
      ? 'bg-red-50 border-red-200 text-red-700'
      : 'bg-blue-50 border-blue-200 text-blue-700'
  
  if (type === 'error') {
    return <div className={cn(base, styles, className)} role="alert">{message}</div>
  }
  return <div className={cn(base, styles, className)} role="status">{message}</div>
}

