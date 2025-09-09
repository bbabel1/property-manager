'use client'

import { useState, useEffect, useRef } from 'react'

interface LiveAddressAutocompleteProps {
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

interface NominatimResult {
  place_id: number
  licence: string
  osm_type: string
  osm_id: number
  boundingbox: string[]
  lat: string
  lon: string
  display_name: string
  class: string
  type: string
  importance: number
  address: {
    house_number?: string
    road?: string
    city?: string
    state?: string
    postcode?: string
    country?: string
    suburb?: string
    neighbourhood?: string
    county?: string
  }
}

export default function LiveAddressAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Enter address...",
  className = "",
  required = false
}: LiveAddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Don't search if input is too short
    if (value.length < 3) {
      setSuggestions([])
      setShowSuggestions(false)
      setSelectedIndex(-1)
      return
    }

    // Debounce the search
    searchTimeoutRef.current = setTimeout(() => {
      searchAddresses(value)
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [value])

  const searchAddresses = async (query: string) => {
    if (query.length < 3) return

    console.log('🔍 Searching for addresses:', query)
    setIsLoading(true)
    try {
      // Use Nominatim (OpenStreetMap) for free geocoding
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=10&countrycodes=us&bounded=1&viewbox=-125,50,-65,25`
      console.log('📡 Fetching from:', url)
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'PropertyManager/1.0'
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch addresses')
      }

      const data: NominatimResult[] = await response.json()
      console.log('✅ Received data:', data.length, 'results')
      
      // Filter for addresses (not just points of interest)
      const addressResults = data.filter(result => 
        result.class === 'place' || 
        result.class === 'highway' || 
        result.class === 'building' ||
        (result.address && (result.address.house_number || result.address.road))
      )

      console.log('📍 Filtered to', addressResults.length, 'address results')
      setSuggestions(addressResults)
      setShowSuggestions(addressResults.length > 0)
      setSelectedIndex(-1)
    } catch (error) {
      console.error('❌ Error searching addresses:', error)
      setSuggestions([])
      setShowSuggestions(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value)
  }

  const handleSuggestionClick = (suggestion: NominatimResult) => {
    const address = formatAddress(suggestion)
    onChange(address)
    setShowSuggestions(false)
    
    if (onPlaceSelect) {
      const placeData = parseAddress(suggestion)
      onPlaceSelect(placeData)
    }
  }

  const formatAddress = (suggestion: NominatimResult): string => {
    const addr = suggestion.address
    if (addr.house_number && addr.road) {
      return `${addr.house_number} ${addr.road}`
    }
    if (addr.road) {
      return addr.road
    }
    return suggestion.display_name.split(',')[0] || suggestion.display_name
  }

  const parseAddress = (suggestion: NominatimResult) => {
    const addr = suggestion.address
    return {
      address: formatAddress(suggestion),
      city: addr.city || addr.suburb || addr.neighbourhood || '',
      state: addr.state || addr.county || '',
      postalCode: addr.postcode || '',
      country: addr.country || 'US'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSuggestionClick(suggestions[selectedIndex])
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setSelectedIndex(-1)
        break
    }
  }

  const handleFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true)
    }
  }

  const handleBlur = () => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => {
      setShowSuggestions(false)
      setSelectedIndex(-1)
    }, 200)
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={isLoading ? "Searching addresses..." : placeholder}
        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`}
        required={required}
        disabled={isLoading}
      />
      
      {isLoading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
        </div>
      )}
      
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          <div className="px-3 py-1 text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
            Live addresses from OpenStreetMap
          </div>
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.place_id}
              className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${
                index === selectedIndex ? 'bg-blue-100' : ''
              }`}
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <div className="font-medium">{formatAddress(suggestion)}</div>
              <div className="text-sm text-gray-600">
                {suggestion.display_name.split(',').slice(1, 4).join(', ')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
