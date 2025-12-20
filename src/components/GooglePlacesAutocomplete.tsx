'use client';

import { useEffect, useRef, useState } from 'react';

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
  autoComplete?: string;
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
  autoComplete,
}: GooglePlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollListenersRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    if (window.google && window.google.maps && window.google.maps.places) {
      initializeAutocomplete();
      setIsInitialized(true);
      setIsLoading(false);
    } else {
      setIsLoading(true);
      // Optionally, you could poll for a short time if you expect the script to load after mount
      const interval = setInterval(() => {
        if (window.google && window.google.maps && window.google.maps.places) {
          clearInterval(interval);
          initializeAutocomplete();
          setIsInitialized(true);
          setIsLoading(false);
        }
      }, 100);
      setTimeout(() => clearInterval(interval), 3000); // Stop polling after 3s
    }
    return () => {
      if (autocompleteRef.current && window.google) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
      // Remove global capture handlers
      document.removeEventListener('mousedown', handlePacClicks, true);
      document.removeEventListener('touchstart', handlePacClicks, true);
      document.removeEventListener('click', handlePacClicks, true);
      // Remove scroll listeners
      scrollListenersRef.current.forEach((remove) => remove());
      scrollListenersRef.current = [];
    };
  }, []);

  // Add scroll listener to reposition dropdown
  useEffect(() => {
    if (!isInitialized || !inputRef.current) return;

    const repositionDropdown = () => {
      const pacContainer = document.querySelector('.pac-container') as HTMLElement;
      if (!pacContainer || !inputRef.current) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/10e44e33-6af1-4518-9366-235df67f3a5e', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'GooglePlacesAutocomplete.tsx:repositionDropdown',
            message: 'repositionDropdown: Missing elements',
            data: { hasPac: !!pacContainer, hasInput: !!inputRef.current },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'post-fix',
            hypothesisId: 'B',
          }),
        }).catch(() => {});
        // #endregion
        return;
      }

      const inputRect = inputRef.current.getBoundingClientRect();
      const pacRect = pacContainer.getBoundingClientRect();
      const currentPosition = pacContainer.style.position;
      const currentTop = pacContainer.style.top;
      const currentLeft = pacContainer.style.left;

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/10e44e33-6af1-4518-9366-235df67f3a5e', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'GooglePlacesAutocomplete.tsx:repositionDropdown',
          message: 'repositionDropdown: Before reposition',
          data: {
            inputTop: inputRect.top,
            inputLeft: inputRect.left,
            inputBottom: inputRect.bottom,
            pacTop: pacRect.top,
            pacLeft: pacRect.left,
            pacPosition: currentPosition,
            pacTopStyle: currentTop,
            pacLeftStyle: currentLeft,
            windowScrollY: window.scrollY,
            windowScrollX: window.scrollX,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'B',
        }),
      }).catch(() => {});
      // #endregion

      // Calculate new position using viewport coordinates (getBoundingClientRect returns viewport-relative)
      // Use fixed positioning to anchor to viewport, not a positioned ancestor
      const newTop = inputRect.bottom;
      const newLeft = inputRect.left;

      // Only update if position changed significantly (avoid thrashing)
      const topDiff = Math.abs(parseFloat(pacContainer.style.top || '0') - newTop);
      const leftDiff = Math.abs(parseFloat(pacContainer.style.left || '0') - newLeft);

      if (
        topDiff > 1 ||
        leftDiff > 1 ||
        !pacContainer.style.position ||
        pacContainer.style.position !== 'fixed'
      ) {
        pacContainer.style.position = 'fixed';
        pacContainer.style.top = `${newTop}px`;
        pacContainer.style.left = `${newLeft}px`;
        pacContainer.style.width = `${inputRect.width}px`;

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/10e44e33-6af1-4518-9366-235df67f3a5e', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'GooglePlacesAutocomplete.tsx:repositionDropdown',
            message: 'repositionDropdown: After reposition',
            data: { newTop, newLeft, newWidth: inputRect.width, topDiff, leftDiff },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'post-fix',
            hypothesisId: 'B',
          }),
        }).catch(() => {});
        // #endregion
      }
    };

    // Listen to window scroll
    const handleWindowScroll = () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/10e44e33-6af1-4518-9366-235df67f3a5e', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'GooglePlacesAutocomplete.tsx:handleWindowScroll',
          message: 'Window scroll event',
          data: { scrollY: window.scrollY, scrollX: window.scrollX },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'C',
        }),
      }).catch(() => {});
      // #endregion
      repositionDropdown();
    };

    // Find scrollable parent containers
    const findScrollableParents = (element: HTMLElement | null): HTMLElement[] => {
      const scrollable: HTMLElement[] = [];
      let current = element?.parentElement;
      while (current) {
        const overflow = window.getComputedStyle(current).overflow;
        const overflowY = window.getComputedStyle(current).overflowY;
        if (
          overflow === 'auto' ||
          overflow === 'scroll' ||
          overflowY === 'auto' ||
          overflowY === 'scroll'
        ) {
          scrollable.push(current);
        }
        current = current.parentElement;
      }
      return scrollable;
    };

    const scrollableParents = findScrollableParents(inputRef.current);

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/10e44e33-6af1-4518-9366-235df67f3a5e', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'GooglePlacesAutocomplete.tsx:useEffect',
        message: 'Setting up scroll listeners',
        data: {
          scrollableParentsCount: scrollableParents.length,
          scrollableParents: scrollableParents.map((p) => ({
            tag: p.tagName,
            className: p.className,
            id: p.id,
          })),
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'C',
      }),
    }).catch(() => {});
    // #endregion

    // Add scroll listeners
    window.addEventListener('scroll', handleWindowScroll, true);
    scrollListenersRef.current.push(() =>
      window.removeEventListener('scroll', handleWindowScroll, true),
    );

    scrollableParents.forEach((parent) => {
      const handleParentScroll = () => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/10e44e33-6af1-4518-9366-235df67f3a5e', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: 'GooglePlacesAutocomplete.tsx:handleParentScroll',
            message: 'Parent scroll event',
            data: {
              parentTag: parent.tagName,
              parentClassName: parent.className,
              parentScrollTop: parent.scrollTop,
              parentScrollLeft: parent.scrollLeft,
            },
            timestamp: Date.now(),
            sessionId: 'debug-session',
            runId: 'post-fix',
            hypothesisId: 'C',
          }),
        }).catch(() => {});
        // #endregion
        repositionDropdown();
      };
      parent.addEventListener('scroll', handleParentScroll, true);
      scrollListenersRef.current.push(() =>
        parent.removeEventListener('scroll', handleParentScroll, true),
      );
    });

    // Initial reposition after a short delay to ensure PAC container exists
    const initialReposition = setTimeout(() => {
      repositionDropdown();
    }, 100);

    return () => {
      clearTimeout(initialReposition);
      scrollListenersRef.current.forEach((remove) => remove());
      scrollListenersRef.current = [];
    };
  }, [isInitialized]);

  // Capture handler that prevents modal (Radix) outside-click from closing
  const handlePacClicks = (e: Event) => {
    const tgt = e.target as HTMLElement | null;
    if (!tgt) return;
    if (tgt.closest('.pac-container')) {
      // Stop the outside click from propagating to the overlay
      e.stopPropagation();
    }
  };

  const initializeAutocomplete = () => {
    if (!inputRef.current) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/10e44e33-6af1-4518-9366-235df67f3a5e', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'GooglePlacesAutocomplete.tsx:87',
          message: 'initializeAutocomplete: inputRef.current is null',
          data: {},
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'post-fix',
          hypothesisId: 'A',
        }),
      }).catch(() => {});
      // #endregion
      return;
    }
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/10e44e33-6af1-4518-9366-235df67f3a5e', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'GooglePlacesAutocomplete.tsx:91',
          message: 'initializeAutocomplete: Google Maps not available',
          data: {},
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'post-fix',
          hypothesisId: 'A',
        }),
      }).catch(() => {});
      // #endregion
      setError('Google Maps not available');
      return;
    }
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/10e44e33-6af1-4518-9366-235df67f3a5e', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'GooglePlacesAutocomplete.tsx:95',
          message: 'initializeAutocomplete: Creating Autocomplete instance',
          data: { inputExists: !!inputRef.current },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'post-fix',
          hypothesisId: 'A',
        }),
      }).catch(() => {});
      // #endregion
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        fields: ['address_components', 'formatted_address', 'geometry'],
      });

      // Install capture listeners after Google injects the dropdown
      // This prevents outside-click from closing surrounding dialogs.
      setTimeout(() => {
        document.addEventListener('mousedown', handlePacClicks, true);
        document.addEventListener('touchstart', handlePacClicks, true);
        document.addEventListener('click', handlePacClicks, true);

        // #region agent log
        const pacContainer = document.querySelector('.pac-container') as HTMLElement;
        if (pacContainer) {
          const inputRect = inputRef.current?.getBoundingClientRect();
          const pacRect = pacContainer.getBoundingClientRect();
          fetch('http://127.0.0.1:7242/ingest/10e44e33-6af1-4518-9366-235df67f3a5e', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: 'GooglePlacesAutocomplete.tsx:106',
              message: 'PAC container found after init',
              data: {
                pacTop: pacRect.top,
                pacLeft: pacRect.left,
                inputTop: inputRect?.top,
                inputLeft: inputRect?.left,
                pacPosition: pacContainer.style.position,
                pacDisplay: pacContainer.style.display,
              },
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'post-fix',
              hypothesisId: 'A',
            }),
          }).catch(() => {});
        } else {
          fetch('http://127.0.0.1:7242/ingest/10e44e33-6af1-4518-9366-235df67f3a5e', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              location: 'GooglePlacesAutocomplete.tsx:106',
              message: 'PAC container not found after init',
              data: {},
              timestamp: Date.now(),
              sessionId: 'debug-session',
              runId: 'post-fix',
              hypothesisId: 'A',
            }),
          }).catch(() => {});
        }
        // #endregion
      }, 0);
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
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
          // Fallbacks for city selection
          city =
            locality ||
            postalTown ||
            sublocality1 ||
            sublocality ||
            adminLevel3 ||
            adminLevel2 ||
            '';

          // geometry
          const lat = place?.geometry?.location?.lat
            ? Number(place.geometry.location.lat())
            : undefined;
          const lng = place?.geometry?.location?.lng
            ? Number(place.geometry.location.lng())
            : undefined;

          // heuristics for borough and neighborhood
          const borough = sublocality1 || adminLevel2 || '';
          const neighborhood =
            place.address_components.find((c: any) => c.types.includes('neighborhood'))
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
  };

  return (
    <div className="relative" ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isLoading ? 'Loading autocomplete...' : placeholder}
        className={`focus-visible:ring-primary focus-visible:ring-offset-background focus-visible:border-primary h-9 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ${className}`}
        required={required}
        disabled={isLoading}
        autoComplete={autoComplete}
      />
      {isLoading && (
        <div className="absolute top-1/2 right-3 -translate-y-1/2 transform">
          <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-blue-600"></div>
        </div>
      )}
      {error && (
        <div className="absolute top-1/2 right-3 -translate-y-1/2 transform">
          <div className="text-xs text-orange-500">⚠️</div>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-orange-600">{error}</p>}
    </div>
  );
}
