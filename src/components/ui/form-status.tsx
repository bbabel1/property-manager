"use client"

import { cn } from './utils'

export function FormStatus({ type, message, className }: { type: 'success'|'error'|'info'; message: string; className?: string }) {
  const base = 'text-sm rounded-md border px-3 py-2'
  const styles = type === 'success'
    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
    : type === 'error'
      ? 'bg-red-50 border-red-200 text-red-700'
      : 'bg-blue-50 border-blue-200 text-blue-700'
  return <div className={cn(base, styles, className)} role={type === 'error' ? 'alert' : undefined}>{message}</div>
}

