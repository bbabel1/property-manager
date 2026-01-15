"use client"

import { cn } from './utils'

export function FormStatus({ type, message, className }: { type: 'success'|'error'|'info'; message: string; className?: string }) {
  const base = 'text-sm rounded-md border px-3 py-2'
  const styles = type === 'success'
    ? 'bg-[var(--color-success-50)] border-[var(--color-success-500)] text-[var(--color-success-700)]'
    : type === 'error'
      ? 'bg-[var(--color-danger-50)] border-[var(--color-danger-600)] text-[var(--color-danger-700)]'
      : 'bg-[var(--surface-primary-soft)] border-[var(--surface-primary-soft-border)] text-[var(--color-action-700)]'
  
  if (type === 'error') {
    return <div className={cn(base, styles, className)} role="alert">{message}</div>
  }
  return <div className={cn(base, styles, className)} role="status">{message}</div>
}
