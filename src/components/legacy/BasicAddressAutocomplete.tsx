'use client';

import React, { useRef } from 'react';

interface BasicAddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect?: (place: {
    address: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  }) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export default function BasicAddressAutocomplete({
  value,
  onChange,
  onPlaceSelect: _onPlaceSelect,
  placeholder = 'Enter address...',
  className = '',
  required = false,
}: BasicAddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        className={`w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none ${className}`}
        required={required}
      />
    </div>
  );
}
