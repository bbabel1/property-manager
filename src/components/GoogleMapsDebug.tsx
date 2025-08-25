'use client'

import { useEffect, useState } from 'react'

export default function GoogleMapsDebug() {
  const [status, setStatus] = useState<string>('Checking...')
  const [googleStatus, setGoogleStatus] = useState<any>(null)

  useEffect(() => {
    const checkGoogleMaps = () => {
      const googleAvailable = window.google
      const mapsAvailable = window.google?.maps
      const placesAvailable = window.google?.maps?.places
      
      setGoogleStatus({
        google: !!googleAvailable,
        maps: !!mapsAvailable,
        places: !!placesAvailable,
        fullObject: window.google
      })

      if (googleAvailable && mapsAvailable && placesAvailable) {
        setStatus('✅ Google Maps fully loaded')
      } else if (googleAvailable && mapsAvailable) {
        setStatus('⚠️ Google Maps loaded but Places API missing')
      } else if (googleAvailable) {
        setStatus('⚠️ Google loaded but Maps API missing')
      } else {
        setStatus('❌ Google Maps not loaded')
      }
    }

    // Check immediately
    checkGoogleMaps()

    // Check again after a delay
    const timer = setTimeout(checkGoogleMaps, 2000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="p-4 bg-gray-100 rounded-lg mb-4">
      <h3 className="font-medium text-gray-900 mb-2">Google Maps Debug Info</h3>
      <p className="text-sm text-gray-600 mb-2">Status: {status}</p>
      <details className="text-xs">
        <summary className="cursor-pointer text-blue-600">Show detailed status</summary>
        <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto">
          {JSON.stringify(googleStatus, null, 2)}
        </pre>
      </details>
    </div>
  )
}
