import React from 'react'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'

type Option = { value: string; label: string }
type OptionGroup = { label: string; options: Option[] }
type DropdownOption = Option | OptionGroup

interface DropdownProps {
  value: string | ''
  onChange: (value: string) => void
  options: DropdownOption[]
  placeholder?: string
  className?: string
  disabled?: boolean
}

function isGroup(option: DropdownOption): option is OptionGroup {
  return typeof (option as OptionGroup)?.options !== 'undefined'
}

// Default dropdown styled via Radix Select (applies app-wide default style)
export function Dropdown({
  value,
  onChange,
  options,
  placeholder,
  className,
  disabled,
}: DropdownProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={className} disabled={disabled}>
        <SelectValue placeholder={placeholder || 'Select...'} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) =>
          isGroup(opt) ? (
            <SelectGroup key={`group-${opt.label}`}>
              <SelectLabel>{opt.label}</SelectLabel>
              {opt.options.map((child) => (
                <SelectItem key={child.value} value={child.value}>
                  {child.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ) : (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          )
        )}
      </SelectContent>
    </Select>
  )
}

export default Dropdown
