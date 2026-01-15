'use client'

import React, { useRef } from 'react'

interface BasicAddressAutocompleteProps {
  id?: string
  value: string
  onChange: (value: string) => void
  _onPlaceSelect?: (place: {
    address: string
    city: string
    state: string
    postalCode: string
    country: string
  }) => void
  placeholder?: string
  className?: string
  required?: boolean
}

export default function BasicAddressAutocomplete({
  id,
  value,
  onChange,
  _onPlaceSelect,
  placeholder = "Enter address...",
  className = "",
  required = false
}: BasicAddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }

  return (
    <div className="relative">
      <input
        id={id}
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`}
        required={required}
      />
    </div>
  )
}
