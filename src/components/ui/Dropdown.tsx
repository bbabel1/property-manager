import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Option = { value: string; label: string }

interface DropdownProps {
  value: string | ''
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
}

// Default dropdown styled via Radix Select (applies app-wide default style)
export function Dropdown({ value, onChange, options, placeholder }: DropdownProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder || 'Select...'} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
