import React from 'react'
import { cn } from '@/lib/utils'

type Option = { value: string; label: string }

interface DropdownProps {
  value: string | ''
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  className?: string
}

// Simple, dependency-free dropdown using native select
export function Dropdown({ value, onChange, options, placeholder, className }: DropdownProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'w-full h-9 px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        className
      )}
    >
      {(!value && placeholder) ? (
        <option value="" disabled hidden>{placeholder}</option>
      ) : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
