'use client';

import * as React from 'react';
import GooglePlacesAutocomplete from './GooglePlacesAutocomplete';

export interface AddressAutocompleteProps {
  id?: string;
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

const AddressAutocomplete = React.forwardRef<HTMLDivElement, AddressAutocompleteProps>(
  (
    {
      id,
      value,
      onChange,
      onPlaceSelect,
      placeholder = 'Enter address...',
      className = '',
      required = false,
      autoComplete,
    },
    ref,
  ) => {
    return (
      <div ref={ref}>
        <GooglePlacesAutocomplete
          id={id}
          value={value}
          onChange={onChange}
          onPlaceSelect={onPlaceSelect}
          placeholder={placeholder}
          className={className}
          required={required}
          autoComplete={autoComplete}
        />
      </div>
    );
  },
);

AddressAutocomplete.displayName = 'AddressAutocomplete';

export default AddressAutocomplete;
