'use client'

import GooglePlacesAutocomplete from './GooglePlacesAutocomplete'

interface AddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onPlaceSelect?: (place: {
    address: string
    city: string
    state: string
    postalCode: string
    country: string
    latitude?: number
    longitude?: number
    borough?: string
    neighborhood?: string
  }) => void
  placeholder?: string
  className?: string
  required?: boolean
  autoComplete?: string
}

export default function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Enter address...",
  className = "",
  required = false,
  autoComplete
}: AddressAutocompleteProps) {
  return (
    <div>
      <GooglePlacesAutocomplete
        value={value}
        onChange={onChange}
        onPlaceSelect={onPlaceSelect}
        placeholder={placeholder}
        className={className}
        required={required}
        autoComplete={autoComplete}
      />
    </div>
  )
}
