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
    latitude?: number
    longitude?: number
    borough?: string
    neighborhood?: string
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
      // Remove global capture handlers
      document.removeEventListener('mousedown', handlePacClicks, true)
      document.removeEventListener('touchstart', handlePacClicks, true)
      document.removeEventListener('click', handlePacClicks, true)
    }
  }, [])

  // Capture handler that prevents modal (Radix) outside-click from closing
  const handlePacClicks = (e: Event) => {
    const tgt = e.target as HTMLElement | null
    if (!tgt) return
    if (tgt.closest('.pac-container')) {
      // Stop the outside click from propagating to the overlay
      e.stopPropagation()
    }
  }

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
        fields: ['address_components', 'formatted_address', 'geometry']
      })

      // Install capture listeners after Google injects the dropdown
      // This prevents outside-click from closing surrounding dialogs.
      setTimeout(() => {
        document.addEventListener('mousedown', handlePacClicks, true)
        document.addEventListener('touchstart', handlePacClicks, true)
        document.addEventListener('click', handlePacClicks, true)
      }, 0)
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace()
        if (place.address_components) {
          let address = ''
          let streetNumber = ''
          let routeName = ''
          let city = ''
          let state = ''
          let postalCode = ''
          let postalSuffix = ''
          let country = ''
          let countryLong = ''

          let locality = ''
          let postalTown = ''
          let sublocality1 = ''
          let sublocality = ''
          let adminLevel3 = ''
          let adminLevel2 = ''

          for (const component of place.address_components) {
            const types = component.types
            if (types.includes('street_number')) {
              streetNumber = component.long_name
            } else if (types.includes('route')) {
              routeName = component.long_name
            } else if (types.includes('locality')) {
              locality = component.long_name
            } else if (types.includes('postal_town')) {
              postalTown = component.long_name
            } else if (types.includes('sublocality_level_1')) {
              sublocality1 = component.long_name
            } else if (types.includes('sublocality')) {
              sublocality = component.long_name
            } else if (types.includes('administrative_area_level_3')) {
              adminLevel3 = component.long_name
            } else if (types.includes('administrative_area_level_2')) {
              adminLevel2 = component.long_name
            } else if (types.includes('administrative_area_level_1')) {
              state = component.short_name
            } else if (types.includes('postal_code')) {
              postalCode = component.long_name
            } else if (types.includes('postal_code_suffix')) {
              postalSuffix = component.long_name
            } else if (types.includes('country')) {
              country = component.short_name
              countryLong = component.long_name
            }
          }

          address = [streetNumber, routeName].filter(Boolean).join(' ').trim()
          if (postalCode && postalSuffix) postalCode = `${postalCode}-${postalSuffix}`
          // Fallbacks for city selection
          city = locality || postalTown || sublocality1 || sublocality || adminLevel3 || adminLevel2 || ''

          // geometry
          const lat = place?.geometry?.location?.lat ? Number(place.geometry.location.lat()) : undefined
          const lng = place?.geometry?.location?.lng ? Number(place.geometry.location.lng()) : undefined

          // heuristics for borough and neighborhood
          const borough = sublocality1 || adminLevel2 || ''
          const neighborhood = (place.address_components.find((c:any)=>c.types.includes('neighborhood'))?.long_name)
            || sublocality || sublocality1 || ''

          onChange(address)
          if (onPlaceSelect) {
            const countryOut = countryLong || country
            onPlaceSelect({ address, city, state, postalCode, country: countryOut, latitude: lat, longitude: lng, borough, neighborhood })
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
