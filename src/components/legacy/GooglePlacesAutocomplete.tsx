'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type AddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

type GooglePlaceResult = {
  address_components?: AddressComponent[];
  geometry?: {
    location?: {
      lat: () => number;
      lng: () => number;
    };
  };
};

type GoogleAutocomplete = {
  addListener: (eventName: 'place_changed', handler: () => void) => void;
  getPlace: () => GooglePlaceResult;
};

type GoogleMapsPlaces = {
  Autocomplete: new (
    input: HTMLInputElement,
    options: { types: string[]; fields: string[] },
  ) => GoogleAutocomplete;
};

type GoogleMaps = {
  places?: GoogleMapsPlaces;
  event?: {
    clearInstanceListeners: (instance: unknown) => void;
  };
};

type GoogleGlobal = {
  maps?: GoogleMaps;
  [key: string]: unknown;
};

interface GooglePlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect?: (place: {
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    latitude?: number;
    longitude?: number;
    borough?: string;
    neighborhood?: string;
  }) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

declare global {
  interface Window {
    google: any;
    [key: string]: any;
  }
}

export default function GooglePlacesAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = 'Enter address...',
  className = '',
  required = false,
}: GooglePlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<GoogleAutocomplete | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getGoogle = useCallback(() => window.google as GoogleGlobal | undefined, []);

  const initializeAutocomplete = useCallback(() => {
    const google = getGoogle();
    if (!inputRef.current) {
      return;
    }
    if (!google?.maps?.places) {
      setError('Google Maps not available');
      return;
    }
    try {
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        fields: ['address_components', 'formatted_address', 'geometry'],
      });
      autocompleteRef.current.addListener('place_changed', () => {
        const autocomplete = autocompleteRef.current;
        if (!autocomplete) return;
        const place = autocomplete.getPlace();
        if (place.address_components) {
          let address = '';
          let streetNumber = '';
          let routeName = '';
          let city = '';
          let state = '';
          let postalCode = '';
          let postalSuffix = '';
          let country = '';
          let countryLong = '';

          let locality = '';
          let postalTown = '';
          let sublocality1 = '';
          let sublocality = '';
          let adminLevel3 = '';
          let adminLevel2 = '';

          for (const component of place.address_components) {
            const types = component.types;
            if (types.includes('street_number')) {
              streetNumber = component.long_name;
            } else if (types.includes('route')) {
              routeName = component.long_name;
            } else if (types.includes('locality')) {
              locality = component.long_name;
            } else if (types.includes('postal_town')) {
              postalTown = component.long_name;
            } else if (types.includes('sublocality_level_1')) {
              sublocality1 = component.long_name;
            } else if (types.includes('sublocality')) {
              sublocality = component.long_name;
            } else if (types.includes('administrative_area_level_3')) {
              adminLevel3 = component.long_name;
            } else if (types.includes('administrative_area_level_2')) {
              adminLevel2 = component.long_name;
            } else if (types.includes('administrative_area_level_1')) {
              state = component.short_name;
            } else if (types.includes('postal_code')) {
              postalCode = component.long_name;
            } else if (types.includes('postal_code_suffix')) {
              postalSuffix = component.long_name;
            } else if (types.includes('country')) {
              country = component.short_name;
              countryLong = component.long_name;
            }
          }

          address = [streetNumber, routeName].filter(Boolean).join(' ').trim();
          if (postalCode && postalSuffix) postalCode = `${postalCode}-${postalSuffix}`;
          city =
            locality || postalTown || sublocality1 || sublocality || adminLevel3 || adminLevel2 || '';

          const lat = place?.geometry?.location?.lat
            ? Number(place.geometry.location.lat())
            : undefined;
          const lng = place?.geometry?.location?.lng
            ? Number(place.geometry.location.lng())
            : undefined;
          const borough = sublocality1 || adminLevel2 || '';
          const neighborhood =
            place.address_components.find((component) => component.types.includes('neighborhood'))
              ?.long_name ||
            sublocality ||
            sublocality1 ||
            '';

          onChange(address);
          if (onPlaceSelect) {
            const countryOut = countryLong || country;
            onPlaceSelect({
              address,
              city,
              state,
              postalCode,
              country: countryOut,
              latitude: lat,
              longitude: lng,
              borough,
              neighborhood,
            });
          }
        }
      });
    } catch (error) {
      setError('Failed to initialize autocomplete');
    }
  }, [getGoogle, onChange, onPlaceSelect]);

  useEffect(() => {
    const hasPlacesApi = () => {
      const google = getGoogle();
      return Boolean(google?.maps?.places);
    };

    let pollInterval: number | undefined;
    let stopPolling: number | undefined;

    if (hasPlacesApi()) {
      initializeAutocomplete();
      setIsInitialized(true);
      setIsLoading(false);
    } else {
      setIsLoading(true);
      pollInterval = window.setInterval(() => {
        if (hasPlacesApi()) {
          if (pollInterval !== undefined) {
            clearInterval(pollInterval);
          }
          initializeAutocomplete();
          setIsInitialized(true);
          setIsLoading(false);
        }
      }, 100);
      stopPolling = window.setTimeout(() => {
        if (pollInterval !== undefined) {
          clearInterval(pollInterval);
        }
      }, 3000);
    }

    return () => {
      if (pollInterval !== undefined) clearInterval(pollInterval);
      if (stopPolling !== undefined) clearTimeout(stopPolling);
      if (autocompleteRef.current) {
        const google = getGoogle();
        google?.maps?.event?.clearInstanceListeners?.(autocompleteRef.current);
      }
    };
  }, [getGoogle, initializeAutocomplete]);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isLoading ? 'Loading autocomplete...' : placeholder}
        className={`focus:ring-blue-500 focus:border-blue-500 h-9 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 ${className}`}
        required={required}
        disabled={isLoading}
      />
      {isLoading && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-blue-600"></div>
        </div>
      )}
      {error && (
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          <div className="text-orange-500 text-xs">⚠️</div>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-orange-600">{error}</p>}
    </div>
  );
}
