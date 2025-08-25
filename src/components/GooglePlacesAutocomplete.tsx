'use client'

import { useEffect, useRef, useState } from 'react'

interface GooglePlacesAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onPlaceSelect?: (place: {
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

declare global {
  interface Window {
    google: any
    [key: string]: any
  }
}

export default function GooglePlacesAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Enter address...",
  className = "",
  required = false
}: GooglePlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<any>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (window.google && window.google.maps && window.google.maps.places) {
      initializeAutocomplete()
      setIsInitialized(true)
      setIsLoading(false)
    } else {
      setIsLoading(true)
      // Optionally, you could poll for a short time if you expect the script to load after mount
      const interval = setInterval(() => {
        if (window.google && window.google.maps && window.google.maps.places) {
          clearInterval(interval)
          initializeAutocomplete()
          setIsInitialized(true)
          setIsLoading(false)
        }
      }, 100)
      setTimeout(() => clearInterval(interval), 3000) // Stop polling after 3s
    }
    return () => {
      if (autocompleteRef.current && window.google) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
    }
  }, [])

  const initializeAutocomplete = () => {
    if (!inputRef.current) {
      return
    }
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      setError('Google Maps not available')
      return
    }
    try {
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'us' },
        fields: ['address_components', 'formatted_address']
      })
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace()
        if (place.address_components) {
          let address = ''
          let city = ''
          let state = ''
          let postalCode = ''
          let country = ''
          for (const component of place.address_components) {
            const types = component.types
            if (types.includes('street_number')) {
              address = component.long_name + ' '
            } else if (types.includes('route')) {
              address += component.long_name
            } else if (types.includes('locality')) {
              city = component.long_name
            } else if (types.includes('administrative_area_level_1')) {
              state = component.short_name
            } else if (types.includes('postal_code')) {
              postalCode = component.long_name
            } else if (types.includes('country')) {
              country = component.short_name
            }
          }
          onChange(address)
          if (onPlaceSelect) {
            console.log('GooglePlacesAutocomplete onPlaceSelect country:', country);
            onPlaceSelect({ address, city, state, postalCode, country })
          }
        }
      })
    } catch (error) {
      setError('Failed to initialize autocomplete')
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isLoading ? "Loading autocomplete..." : placeholder}
        className={`w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${className}`}
        required={required}
        disabled={isLoading}
      />
      {isLoading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        </div>
      )}
      {error && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="text-orange-500 text-xs">⚠️</div>
        </div>
      )}
      {error && (
        <p className="text-xs text-orange-600 mt-1">{error}</p>
      )}
    </div>
  )
}
