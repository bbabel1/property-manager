import React from 'react'

type Option = { value: string; label: string }

interface DropdownProps {
  value: string | ''
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
}

// Simple, dependency-free dropdown using native select
export function Dropdown({ value, onChange, options, placeholder }: DropdownProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-9 px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
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
